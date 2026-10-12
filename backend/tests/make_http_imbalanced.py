import numpy as np
import pandas as pd

rng = np.random.RandomState(7)
df = pd.DataFrame({
    "f1": rng.randn(53),
    "f2": rng.randn(53),
    "label": ["A"] * 10 + ["B"] * 40 + ["C"] * 3,
})
df.to_csv(r"C:\Users\mayuresh\Downloads\automl-platform-main\automl-platform-main\dataset\_t_imbalanced_http.csv", index=False)
print("written")