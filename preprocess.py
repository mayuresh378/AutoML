import pandas as pd
import numpy as np
import os

def auto_preprocess(file_name: str, target_column: str):
    """
    Automatically loads a dataset, handles missing values, 
    and prepares it for machine learning training.
    """
    # 1. Load the file from our dataset directory
    file_path = os.path.join("..", "dataset", file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset {file_name} not found.")
        
    df = pd.read_csv(file_path)
    print(f"--- Initializing AutoML Preprocessing for {file_name} ---")
    
    # 2. Check if the target column exists
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' matches nothing in the dataset.")

    # 3. Handle Missing Values automatically
    for col in df.columns:
        missing_count = df[col].isnull().sum()
        if missing_count > 0:
            print(f"Found {missing_count} missing values in '{col}'. Fixing...")
            if df[col].dtype in ['int64', 'float64']:
                # Fill numbers with the median
                df[col] = df[col].fillna(df[col].median())
            else:
                # Fill text/categories with the most frequent value (mode)
                df[col] = df[col].fillna(df[col].mode()[0])

    # 4. Separate Features (X) and Target (y)
    X = df.drop(columns=[target_column])
    y = df[target_column]

    # 5. One-Hot Encode categorical text variables into numeric columns
    # Machine learning models can only read numbers, not raw text strings.
    X = pd.get_dummies(X, drop_first=True)
    
    # Ensure all boolean columns from get_dummies become 1s and 0s
    for col in X.select_dtypes(include=['bool']).columns:
        X[col] = X[col].astype(int)

    print("Preprocessing complete! Categorical features encoded to numbers.")
    return X, y