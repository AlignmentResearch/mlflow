# MLflow Stdout Tab Guide

The stdout tab functionality is already implemented in MLflow! This guide shows you how to use it.

## How It Works

MLflow captures stdout output during run execution and stores it as an artifact called `stdout.log`. The frontend displays this content in a dedicated "Stdout" tab.

## Backend Usage

### Basic Usage

```python
import mlflow

with mlflow.start_run(log_stdout=True):
    print("This will appear in the stdout tab!")
    # Your code here
```

### With Custom Interval

```python
import mlflow

# Log stdout every 3 seconds instead of default 5
with mlflow.start_run(log_stdout=True, log_stdout_interval=3):
    print("This will appear in the stdout tab!")
    # Your code here
```

## Frontend Features

The stdout tab includes:

- **Syntax highlighting** for better readability
- **Line numbers** for easy navigation
- **Dark/light theme** support
- **Auto-scrolling** and text wrapping
- **Error handling** for missing or empty stdout logs

## Tab Location

The stdout tab appears in the run details page alongside:

- Overview
- Model metrics
- System metrics
- **Stdout** ← Here!
- Artifacts

## Testing

Run the test script to verify everything works:

```bash
python test_stdout_tab.py
```

Then:

1. Open MLflow UI (usually http://localhost:5000)
2. Navigate to the test run
3. Click the "Stdout" tab
4. You should see all the captured output!

## Implementation Details

### Backend Files

- `mlflow/utils/stdout_logging.py` - Core stdout capture logic
- `mlflow/tracking/fluent.py` - Integration with start_run()

### Frontend Files

- `mlflow/server/js/src/experiment-tracking/components/run-page/RunViewStdoutTab.tsx` - Tab component
- `mlflow/server/js/src/experiment-tracking/components/run-page/RunViewModeSwitch.tsx` - Tab switcher
- `mlflow/server/js/src/experiment-tracking/constants.ts` - Tab definitions

## Similar to Wandb

This provides similar functionality to Wandb's stdout logging, where you can:

- View real-time stdout output
- Navigate through logs easily
- Keep logs organized per run
- Access logs directly from the UI

The stdout tab is ready to use - no additional setup required!
