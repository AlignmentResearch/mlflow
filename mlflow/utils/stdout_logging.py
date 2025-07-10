import os
import select
import threading
import time
from contextlib import contextmanager
from io import StringIO

import mlflow


@contextmanager
def log_stdout_stream(run_id, interval_seconds=5, capture_stderr=True):
    """
    A context manager to stream stdout (and optionally stderr) to an MLflow artifact.

    This context manager redirects file descriptor 1 (stdout) and optionally
    file descriptor 2 (stderr) to capture output from both Python code and
    underlying C/C++ libraries. A background thread periodically flushes this
    buffer and logs its contents to an MLflow artifact file named 'stdout.log'.

    Args:
        run_id (str): The run ID to log stdout to.
        interval_seconds (int): The interval in seconds at which to log
                                the stdout buffer to MLflow.
        capture_stderr (bool): Whether to also capture stderr output.
                              Defaults to True.

    Example:
        import time
        import mlflow
        import subprocess

        with mlflow.start_run() as run:
            with log_stdout_stream(run.info.run_id, capture_stderr=True):
                print("This is the start of my script.")
                print("This error goes to stderr!", file=sys.stderr)
                time.sleep(6)
                print("This message will appear in the first log upload.")
                subprocess.run(["echo", "This C/C++ output will also be captured"])
                time.sleep(6)
                print("And this will be in the second.")
            # The context manager will automatically handle final log upload
            # and cleanup.
        print("Stdout is now back to normal.")
    """
    stdout_buffer = StringIO()

    # Save original file descriptors
    original_stdout_fd = os.dup(1)
    original_stderr_fd = os.dup(2) if capture_stderr else None

    # Create pipes for capturing file descriptors
    stdout_pipe_read, stdout_pipe_write = os.pipe()
    stderr_pipe_read, stderr_pipe_write = os.pipe() if capture_stderr else (None, None)

    # Redirect file descriptors to pipes
    os.dup2(stdout_pipe_write, 1)
    os.close(stdout_pipe_write)

    if capture_stderr and stderr_pipe_write is not None:
        os.dup2(stderr_pipe_write, 2)
        os.close(stderr_pipe_write)

    stop_event = threading.Event()
    log_thread = None
    stdout_pipe_thread = None
    stderr_pipe_thread = None

    def _stdout_pipe_reader():
        """Read from the stdout pipe and write to both original stdout and buffer."""
        while not stop_event.is_set():
            # Use select to check if there's data available to read
            ready, _, _ = select.select([stdout_pipe_read], [], [], 0.1)
            if ready:
                try:
                    data = os.read(stdout_pipe_read, 4096)
                    if data:
                        # Decode bytes to string
                        text = data.decode("utf-8", errors="replace")
                        # Write to original stdout
                        os.write(original_stdout_fd, data)
                        # Write to buffer
                        stdout_buffer.write(text)
                except OSError:
                    break

    def _stderr_pipe_reader():
        """Read from the stderr pipe and write to both original stderr and buffer."""
        if not capture_stderr or stderr_pipe_read is None or original_stderr_fd is None:
            return

        while not stop_event.is_set():
            # Use select to check if there's data available to read
            ready, _, _ = select.select([stderr_pipe_read], [], [], 0.1)
            if ready:
                try:
                    data = os.read(stderr_pipe_read, 4096)
                    if data:
                        # Decode bytes to string
                        text = data.decode("utf-8", errors="replace")
                        # Write to original stderr
                        os.write(original_stderr_fd, data)
                        # Write to buffer (combined with stdout)
                        stdout_buffer.write(text)
                except OSError:
                    break

    def _log_loop():
        while not stop_event.is_set():
            time.sleep(interval_seconds)
            _log_current_stdout()

    def _log_current_stdout():
        content = stdout_buffer.getvalue()

        if content:
            mlflow.log_text(content, "stdout.log", run_id=run_id)

    try:
        # Start the stdout pipe reader thread
        stdout_pipe_thread = threading.Thread(
            target=_stdout_pipe_reader, name="mlflow-stdout-pipe-reader"
        )
        stdout_pipe_thread.daemon = True
        stdout_pipe_thread.start()

        # Start the stderr pipe reader thread if capturing stderr
        if capture_stderr:
            stderr_pipe_thread = threading.Thread(
                target=_stderr_pipe_reader, name="mlflow-stderr-pipe-reader"
            )
            stderr_pipe_thread.daemon = True
            stderr_pipe_thread.start()

        # Start the logging thread
        log_thread = threading.Thread(target=_log_loop, name="mlflow-stdout-logging")
        log_thread.daemon = True
        log_thread.start()

        yield
    finally:
        # Signal threads to stop
        stop_event.set()

        # Flush any remaining buffered output before restoring file descriptors
        try:
            # Force flush of file descriptors to ensure all output is captured
            os.fsync(1)
            if capture_stderr and original_stderr_fd is not None:
                os.fsync(2)
        except OSError:
            pass  # fsync may not be available on all platforms

        # Small delay to ensure all buffered output is processed
        time.sleep(0.1)

        # Restore file descriptors
        os.dup2(original_stdout_fd, 1)
        os.close(original_stdout_fd)

        if capture_stderr and original_stderr_fd is not None:
            os.dup2(original_stderr_fd, 2)
            os.close(original_stderr_fd)

        # Wait for threads to finish
        if stdout_pipe_thread:
            stdout_pipe_thread.join(timeout=1.0)
        if stderr_pipe_thread:
            stderr_pipe_thread.join(timeout=1.0)
        if log_thread:
            log_thread.join(timeout=1.0)

        # Close the pipes
        os.close(stdout_pipe_read)
        if capture_stderr and stderr_pipe_read is not None:
            os.close(stderr_pipe_read)

        # Final flush and log to capture any remaining output
        _log_current_stdout()

        # Close the buffer
        stdout_buffer.close()
