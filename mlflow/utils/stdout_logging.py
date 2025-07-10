import os
import select
import threading
import time
from contextlib import contextmanager
from io import StringIO
from typing import Optional

import mlflow


class _PipeManager:
    """Manages a pipe for capturing file descriptor output."""

    def __init__(self, fd_num: int, original_fd: int, buffer: StringIO, name: str):
        self.fd_num = fd_num
        self.original_fd = original_fd
        self.buffer = buffer
        self.name = name
        self.pipe_read: Optional[int] = None
        self.pipe_write: Optional[int] = None
        self.thread: Optional[threading.Thread] = None

    def setup_pipe(self):
        """Create and setup the pipe for this file descriptor."""
        self.pipe_read, self.pipe_write = os.pipe()
        os.dup2(self.pipe_write, self.fd_num)
        os.close(self.pipe_write)
        self.pipe_write = None

    def start_reader_thread(self, stop_event: threading.Event):
        """Start the pipe reader thread."""
        if self.pipe_read is None:
            return

        def _pipe_reader():
            """Read from the pipe and write to both original fd and buffer."""
            pipe_read = self.pipe_read  # Capture for type safety
            if pipe_read is None:
                return

            while not stop_event.is_set():
                # Use select to check if there's data available to read
                ready, _, _ = select.select([pipe_read], [], [], 0.1)
                if ready:
                    try:
                        data = os.read(pipe_read, 4096)
                        if data:
                            # Decode bytes to string
                            text = data.decode("utf-8", errors="replace")
                            # Write to original file descriptor
                            os.write(self.original_fd, data)
                            # Write to buffer
                            self.buffer.write(text)
                    except OSError:
                        break

        self.thread = threading.Thread(target=_pipe_reader, name=f"mlflow-{self.name}-pipe-reader")
        self.thread.daemon = True
        self.thread.start()

    def cleanup(self):
        """Clean up the pipe and restore the original file descriptor."""
        # Restore original file descriptor
        os.dup2(self.original_fd, self.fd_num)
        os.close(self.original_fd)

        # Wait for thread to finish
        if self.thread:
            self.thread.join(timeout=1.0)

        # Close the pipe
        if self.pipe_read is not None:
            os.close(self.pipe_read)


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

    # Create pipe managers
    stdout_manager = _PipeManager(1, os.dup(1), stdout_buffer, "stdout")
    stderr_manager = None
    if capture_stderr:
        stderr_manager = _PipeManager(2, os.dup(2), stdout_buffer, "stderr")

    # Setup pipes
    stdout_manager.setup_pipe()
    if stderr_manager:
        stderr_manager.setup_pipe()

    stop_event = threading.Event()
    log_thread = None

    def _log_loop():
        while not stop_event.is_set():
            time.sleep(interval_seconds)
            _log_current_stdout()

    def _log_current_stdout():
        content = stdout_buffer.getvalue()
        if content:
            mlflow.log_text(content, "stdout.log", run_id=run_id)

    try:
        # Start pipe reader threads
        stdout_manager.start_reader_thread(stop_event)
        if stderr_manager:
            stderr_manager.start_reader_thread(stop_event)

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
            if capture_stderr:
                os.fsync(2)
        except OSError:
            pass  # fsync may not be available on all platforms

        # Small delay to ensure all buffered output is processed
        time.sleep(0.1)

        # Clean up pipe managers
        stdout_manager.cleanup()
        if stderr_manager:
            stderr_manager.cleanup()

        # Wait for logging thread to finish
        if log_thread:
            log_thread.join(timeout=1.0)

        # Final flush and log to capture any remaining output
        _log_current_stdout()

        # Close the buffer
        stdout_buffer.close()
