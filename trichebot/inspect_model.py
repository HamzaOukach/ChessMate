import joblib
import pandas as pd
import traceback

try:
    model = joblib.load("chess_cheating_model.joblib")
    print("Model steps:", [s[0] for s in model.steps] if hasattr(model, "steps") else "No steps")
    
    # Check for feature names if it's a pipeline or model
    if hasattr(model, "feature_names_in_"):
        print("Feature names in model:", list(model.feature_names_in_))
    elif hasattr(model, "steps"):
        # Check the last step (classifier)
        last_step = model.steps[-1][1]
        if hasattr(last_step, "feature_names_in_"):
             print("Feature names in classifier:", list(last_step.feature_names_in_))
except Exception as e:
    print(f"Error inspecting model: {e}")
    traceback.print_exc()
