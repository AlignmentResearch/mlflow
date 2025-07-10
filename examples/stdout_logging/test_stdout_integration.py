#!/usr/bin/env python3
"""
MLflow Stdout Logging Integration Test

This test demonstrates the enhanced stdout logging that captures output from:
1. Python print statements (sys.stdout)
2. C/C++ libraries via subprocess calls
3. System commands via os.system()
4. C library functions via ctypes

The test requires MLflow server to be running. Start it with:
    mlflow server --host 127.0.0.1 --port 5002

Expected behavior:
- All output appears in both terminal and MLflow artifact 'stdout.log'
- Both Python and C/C++ stdout are captured
- Final message appears only in terminal (after run ends)
"""

import ctypes
import os
import subprocess
import sys
import time

import mlflow

mlflow.set_tracking_uri("http://127.0.0.1:5002")

if __name__ == "__main__":
    mlflow.set_experiment("stdout_test")

    print("Testing stdout logging integration...")

    with mlflow.start_run(log_stdout=True, log_stdout_interval=3) as run:
        print(f"MLflow Run ID: {run.info.run_id}")
        print("This should appear in both terminal and MLflow!")

        # Test Python stdout
        print("=== Testing Python stdout ===")
        for i in range(3):
            print(f"Python message {i + 1}/3")
            time.sleep(1)

        # Test C/C++ stdout via subprocess
        print("\n=== Testing C/C++ stdout via subprocess ===")
        try:
            subprocess.run(["echo", "Hello from echo command!"], check=True)
            subprocess.run(["printf", "Formatted output from printf: %d\\n", "42"], check=True)
            if sys.platform.startswith("linux") or sys.platform.startswith("darwin"):
                subprocess.run(["ls", "-la", "/tmp"], check=True, stdout=None)
        except subprocess.CalledProcessError as e:
            print(f"Subprocess failed: {e}")
        except FileNotFoundError:
            print("Some commands not available on this system")

        # Test C/C++ stdout via os.system
        print("\n=== Testing C/C++ stdout via os.system ===")
        os.system("echo 'Hello from os.system!'")
        if sys.platform.startswith("win"):
            os.system("dir")
        else:
            os.system("date")

        # Test C library stdout via ctypes
        print("\n=== Testing C library stdout via ctypes ===")
        try:
            # Get libc using the portable approach
            if sys.platform.startswith("win"):
                libc = ctypes.CDLL("msvcrt")
                libc.printf(b"Hello from C printf via ctypes!\n")
                try:
                    libc.fflush(None)  # Flush all open streams
                except Exception:
                    pass  # fflush may not be available
            else:
                # Use ctypes.util.find_library to find libc
                import ctypes.util

                libc_path = ctypes.util.find_library("c")
                if libc_path:
                    libc = ctypes.CDLL(libc_path)
                    libc.printf(b"Hello from C printf via ctypes!\n")
                    libc.puts(b"Hello from C puts via ctypes!")
                    try:
                        libc.fflush(None)  # Flush all open streams
                    except Exception:
                        pass  # fflush may not be available
                else:
                    print("Could not find libc library")
        except (OSError, ImportError) as e:
            print(f"Could not load C library: {e}")

        # Force flush of stdout to ensure all output is captured
        sys.stdout.flush()
        try:
            os.fsync(1)  # Force flush of file descriptor 1
        except OSError:
            pass  # fsync may not be available on all platforms

        # Test more Python stdout
        print("\n=== Back to Python stdout ===")
        N_LOGS = 5
        for i in range(N_LOGS):
            print(f"Final Python message {i + 1}/{N_LOGS}")
            time.sleep(1)

        print("Test completed!")

    print("This message should only appear in terminal (run has ended)")
