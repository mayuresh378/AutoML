from fastapi import FastAPI, UploadFile, File, Form
import pandas as pd
import os
from preprocess import auto_preprocess
# 🌟 Import our new training function
from train import run_automl_training

app = FastAPI(title="AutoML Platform API")
DATASET_DIR = os.path.join("..", "dataset")

@app.get("/")
def home():
    return {"status": "AutoML Backend is running smoothly!"}

@app.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    file_location = os.path.join(DATASET_DIR, file.filename)
    with open(file_location, "wb") as f:
        f.write(await file.read())
    df = pd.read_csv(file_location)
    return {"message": f"Successfully uploaded {file.filename}", "features": list(df.columns)}

# 🌟 UPDATED ENDPOINT: Process AND Train automatically
@app.post("/train")
def train_automl(file_name: str = Form(...), target_column: str = Form(...)):
    try:
        # Step 1: Clean and Prepare Data
        X, y = auto_preprocess(file_name, target_column)
        
        # Step 2: Search for the best model and save it
        training_results = run_automl_training(X, y, model_name_prefix=file_name.split('.')[0])
        
        return {
            "status": "Success",
            "message": "AutoML pipeline executed successfully!",
            "data_summary": {
                "features_count": X.shape[1],
                "rows_count": X.shape[0]
            },
            "training_summary": training_results
        }
    except Exception as e:
        return {"status": "Error", "detail": str(e)}