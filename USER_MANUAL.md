# User Manual

## Getting Started

### Registration & Login
1. Open the application in your browser
2. Click "Sign Up" and enter your name, email, and password
3. Verify your email via the confirmation link (if SMTP configured)
4. Log in with your credentials
5. You are redirected to the Dashboard

### Dashboard Overview
The Dashboard shows:
- Total experiments, models, deployments, datasets
- Recent activity timeline
- Storage usage
- Quick-action buttons for common tasks

## Working with Datasets

### Upload a Dataset
1. Navigate to Datasets
2. Drag and drop a CSV, Excel, Parquet, or JSON file (max 500MB)
3. Optionally assign to a project
4. The system automatically profiles your data (rows, columns, dtypes)

### Preview & Profile
- Preview: View first N rows of your dataset
- Profile: Column statistics (mean, min, max, nulls, uniques)
- Analyze: Correlation matrix, target analysis

### Clean & Transform
1. Open a dataset and click "Clean"
2. Choose operations: remove nulls, fill missing, remove duplicates, scale, encode
3. Click "Auto Clean" for automatic suggestions
4. Feature Engineering: Generate polynomial features, interactions, binning

## Training Models

### AutoML Training
1. Go to Training page
2. Select a dataset and target column
3. Optionally set task type (auto-detected)
4. Click "Start Training"
5. The system trains multiple algorithms with cross-validation
6. Results show: best model, accuracy/F1/R2, training time, feature importance
7. The best model is automatically registered in the Model Registry

### Hyperparameter Tuning (HPO)
1. Go to HPO Tuning page
2. Select a dataset and target
3. Configure search space (Grid Search)
4. System evaluates all parameter combinations
5. Best parameters and model are saved

### AutoML Engine
Advanced settings: algorithm selection, train/test split ratio, cross-validation folds

## Working with Models

### Model Registry
- View all trained models with versioning
- Filter by status (Staging, Production, Archived)
- Download model artifacts (.pkl + metadata)
- Update model stage/status

### Model Comparison
Select multiple models to compare:
- Side-by-side metrics (accuracy, precision, recall, F1, RMSE, R2)
- Radar chart visualization
- Performance scatter plot

### Explainable AI
1. Select a model
2. View SHAP feature importance
3. Force plot for individual predictions
4. Summary plot across the dataset

## Deployments

### Deploy a Model
1. Go to Deployment page
2. Select a model from the registry
3. Choose environment (Staging / Production)
4. Configure endpoint settings
5. Deploy - an API endpoint is generated

### Inference
- Single prediction: POST input features, get prediction + confidence
- Batch prediction: Upload CSV, download predictions
- Prediction history: View past inference requests

## Pipelines & Automations

### Pipelines
Create multi-step ML pipelines:
1. Define steps (load -> clean -> train -> evaluate)
2. Run pipeline manually or on schedule
3. View execution history and results

### Automations
Set up trigger-based automations:
- Webhook triggers
- Schedule-based (cron)
- Event-driven (new dataset, model ready)

## Search & Discovery

### Global Search
Search across all resources:
- Experiments, Models, Datasets, Projects, Deployments
- Results grouped by category
- Click to navigate directly

## AI Assistant

Ask natural language questions:
- "What is my best model?"
- "Show me experiments from last week"
- "Which dataset has the most rows?"
- "Compare model accuracy"

## Settings

### Profile
- Update name, email, avatar
- Change password
- View active sessions

### Notifications
- Configure notification types
- Mark all as read
- Clear notification history

### API Keys
Generate and manage API keys for programmatic access
