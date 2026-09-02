import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
# Import a few candidate models to test
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

def run_automl_training(X, y, model_name_prefix: str = "automl_model"):
    """
    Trains multiple models on the data, evaluates accuracy,
    and saves the best model to the models/ directory.
    """
    # 1. Split into training and testing sets (80/20 split)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 2. Define the candidate models
    candidate_models = {
        "LogisticRegression": LogisticRegression(max_iter=1000),
        "RandomForest": RandomForestClassifier(n_estimators=100, random_state=42),
        "GradientBoosting": GradientBoostingClassifier(random_state=42)
    }

    best_model = None
    best_accuracy = 0.0
    best_model_name = ""

    print("\n--- Starting Automated Model Selection ---")
    
    # 3. Train and compete
    for name, model in candidate_models.items():
        try:
            # Train the model
            model.fit(X_train, y_train)
            # Evaluate performance
            predictions = model.predict(X_test)
            acc = accuracy_score(y_test, predictions)
            print(f"Model: {name} | Accuracy: {acc:.4f}")

            # Keep track of the winner
            if acc > best_accuracy:
                best_accuracy = acc
                best_model = model
                best_model_name = name
        except Exception as e:
            print(f"Failed to train {name}: {e}")

    # 4. Save the winning model to the /models directory
    if best_model:
        model_filename = f"{model_name_prefix}_{best_model_name}.pkl"
        save_path = os.path.join("..", "models", model_filename)
        
        # Save model weights
        joblib.dump(best_model, save_path)
        print(f"🏆 Winner: {best_model_name} ({best_accuracy:.4f} Accuracy). Saved to {save_path}\n")
        
        return {
            "best_model": best_model_name,
            "accuracy": best_accuracy,
            "saved_at": save_path
        }
    else:
        raise RuntimeError("No models were successfully trained.")