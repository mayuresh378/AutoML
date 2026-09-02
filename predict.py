import os
import joblib
import pandas as pd

def make_prediction(model_filename: str, input_data: dict):
    """
    Loads a trained model and makes a prediction on fresh input data.
    """
    model_path = os.path.join("..", "models", model_filename)
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file '{model_filename}' not found in models directory.")
        
    # 1. Load the serialized model weights
    model = joblib.load(model_path)
    
    # 2. Convert input dictionary to a single-row Pandas DataFrame
    df_input = pd.DataFrame([input_data])
    
    # 3. Handle categorical encoding consistency
    # (Note: In production, you would match the exact one-hot encoded column names 
    # from training. For this prototype, we pass the data right into the model)
    try:
        prediction = model.predict(df_input)
        
        # If the model outputs probabilities (like classification), get confidence
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(df_input)[0]
            confidence = float(max(probabilities))
        else:
            confidence = 1.0  # Default if probability isn't supported
            
        return {
            "prediction": int(prediction[0]) if hasattr(prediction[0], 'item') else prediction[0],
            "confidence": confidence
        }
    except Exception as e:
        raise ValueError(f"Error alignment between input features and model requirements: {str(e)}")