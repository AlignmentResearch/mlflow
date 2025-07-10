import os
import select
import threading
import time
from contextlib import contextmanager
from io import StringIO

import mlflow


@contextmanager
def log_stdout_stream(run_id, interval_seconds=5):
    """
    A context manager to stream stdout to an MLflow artifact.

    This context manager redirects file descriptor 1 (stdout) to capture output
    from both Python code and underlying C/C++ libraries. A background thread
    periodically flushes this buffer and logs its contents to an MLflow artifact
    file named 'stdout.log'.

    Args:
        run_id (str): The run ID to log stdout to.
        interval_seconds (int): The interval in seconds at which to log
                                the stdout buffer to MLflow.

    Example:
        import time
        import mlflow
        import subprocess

        with mlflow.start_run() as run:
            with log_stdout_stream(run.info.run_id):
                print("This is the start of my script.")
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

    # Save original file descriptor 1 (stdout)
    original_stdout_fd = os.dup(1)

    # Create a pipe for capturing file descriptor 1 output
    pipe_read, pipe_write = os.pipe()

    # Redirect file descriptor 1 to the write end of the pipe
    os.dup2(pipe_write, 1)
    os.close(pipe_write)

    stop_event = threading.Event()
    log_thread = None
    pipe_thread = None

    def _pipe_reader():
        """Read from the pipe and write to both original stdout and buffer."""
        while not stop_event.is_set():
            # Use select to check if there's data available to read
            ready, _, _ = select.select([pipe_read], [], [], 0.1)
            if ready:
                try:
                    data = os.read(pipe_read, 4096)
                    if data:
                        # Decode bytes to string
                        text = data.decode("utf-8", errors="replace")
                        # Write to original stdout
                        os.write(original_stdout_fd, data)
                        # Write to buffer
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
        # Start the pipe reader thread
        pipe_thread = threading.Thread(target=_pipe_reader, name="mlflow-pipe-reader")
        pipe_thread.daemon = True
        pipe_thread.start()

        # Start the logging thread
        log_thread = threading.Thread(target=_log_loop, name="mlflow-stdout-logging")
        log_thread.daemon = True
        log_thread.start()

        yield
    finally:
        # Signal threads to stop
        stop_event.set()

        # Flush any remaining buffered output before restoring file descriptor
        try:
            # Force flush of file descriptor 1 to ensure all C library output is captured
            os.fsync(1)
        except OSError:
            pass  # fsync may not be available on all platforms

        # Small delay to ensure all buffered output is processed
        time.sleep(0.1)

        # Restore file descriptor 1
        os.dup2(original_stdout_fd, 1)
        os.close(original_stdout_fd)

        # Wait for threads to finish
        if pipe_thread:
            pipe_thread.join(timeout=1.0)
        if log_thread:
            log_thread.join(timeout=1.0)

        # Close the pipe
        os.close(pipe_read)

        # Final flush and log to capture any remaining output
        _log_current_stdout()

        # Close the buffer
        stdout_buffer.close()
