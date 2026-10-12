import numpy as np
import pandas as pd

rng = np.random.RandomState(42)
df = pd.DataFrame({
    "feature": rng.randn(150),
    "category_code": rng.randint(0, 5, 150),
    "product_name": [f"Product {i} - Series-Q{i % 9}" for i in range(150)],
})
df.to_csv(r"C:\Users\mayuresh\Downloads\automl-platform-main\automl-platform-main\dataset\_t_product_http.csv", index=False)
print("written")