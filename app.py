import streamlit as st
import requests
import json
import pandas as pd

# --- CONFIGURATION ---
st.set_page_config(
    page_title="AutoML Studio",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

BACKEND_URL = "http://127.0.0.1:8000"

# --- GLOBAL STYLE ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    html, body, [class*="css"]  {
        font-family: 'Inter', sans-serif;
    }

    .block-container {
        padding-top: 2.5rem;
        padding-bottom: 3rem;
        max-width: 1200px;
    }

    /* Header */
    .app-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 0.25rem;
    }
    .app-header h1 {
        font-size: 2rem;
        font-weight: 700;
        margin: 0;
    }
    .app-subtitle {
        color: #6b7280;
        font-size: 1rem;
        margin-bottom: 1.5rem;
    }

    /* Metric cards */
    div[data-testid="stMetric"] {
        background-color: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 16px 18px;
    }
    div[data-testid="stMetricLabel"] {
        font-weight: 500;
        color: #6b7280;
    }

    /* Buttons */
    .stButton > button {
        border-radius: 8px;
        font-weight: 600;
        padding: 0.5rem 1rem;
    }

    /* Containers with border */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border-radius: 12px !important;
    }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #fafafa;
        border-right: 1px solid #eee;
    }

    /* Tabs */
    button[data-baseweb="tab"] {
        font-weight: 600;
    }
    </style>
""", unsafe_allow_html=True)

# --- SIDEBAR: STATUS ---
with st.sidebar:
    st.markdown("### ⚡ AutoML Studio")
    st.caption("Model training & inference control panel")
    st.divider()

    st.markdown("**Backend status**")
    try:
        backend_check = requests.get(f"{BACKEND_URL}/", timeout=2)
        if backend_check.status_code == 200:
            st.success("Connected", icon="✅")
        else:
            st.warning("Responding with errors", icon="⚠️")
    except requests.exceptions.ConnectionError:
        st.error("Not reachable", icon="❌")
        st.caption("Start your backend with `uvicorn main:app --reload`")

    st.divider()
    st.markdown("**Environment**")
    st.caption(f"API: `{BACKEND_URL}`")
    st.caption("Protocol: REST / JSON")

# --- HEADER ---
st.markdown('<div class="app-header"><h1>⚡ AutoML Studio</h1></div>', unsafe_allow_html=True)
st.markdown(
    '<div class="app-subtitle">Upload data, race models automatically, and serve predictions — all in one place.</div>',
    unsafe_allow_html=True
)

tab1, tab2, tab3 = st.tabs(["📊  Upload Data", "🤖  Train Models", "🎯  Get Predictions"])

# --- TAB 1: DATA UPLOAD ---
with tab1:
    st.subheader("Upload your dataset")
    st.caption("Add a CSV file to make it available for training.")

    uploaded_file = st.file_uploader("Upload CSV", type=["csv"], label_visibility="collapsed")

    if uploaded_file is not None:
        st.divider()
        c1, c2 = st.columns([1, 2])

        with c1:
            st.markdown("**File details**")
            st.metric(label="Size", value=f"{uploaded_file.size / 1000:.1f} KB")
            st.markdown(f"`{uploaded_file.name}`")
            st.write("")
            submit_btn = st.button("🚀 Upload & Validate", use_container_width=True, type="primary")

        with c2:
            st.markdown("**Preview**")
            try:
                preview_df = pd.read_csv(uploaded_file)
                st.dataframe(preview_df.head(5), use_container_width=True)
                uploaded_file.seek(0)  # reset pointer for the upload request
            except Exception:
                st.caption("Couldn't preview this file — it may not be a valid CSV.")

        if submit_btn:
            files = {"file": (uploaded_file.name, uploaded_file.getvalue(), "text/csv")}
            try:
                with st.status("Uploading and validating your data...", expanded=True) as status:
                    response = requests.post(f"{BACKEND_URL}/upload", files=files)
                    if response.status_code == 200:
                        status.update(label="Upload complete", state="complete", expanded=False)
                        st.success("Your file is ready for training.")
                        with st.expander("Detected columns"):
                            st.json(response.json()["features"])
                    else:
                        status.update(label="Upload failed", state="error")
                        st.error("The backend rejected this file. Check its format and try again.")
            except Exception as e:
                st.error(f"Couldn't reach the backend: {e}")
    else:
        st.info("Drag and drop a CSV file above to get started.")

# --- TAB 2: TRAIN MODELS ---
with tab2:
    st.subheader("Train and compare models")
    st.caption("We'll train several classifiers and automatically pick the best one.")

    with st.container(border=True):
        col_left, col_right = st.columns(2)
        with col_left:
            file_name = st.text_input("Dataset filename", placeholder="e.g., iris.csv")
        with col_right:
            target_column = st.text_input("Column to predict", placeholder="e.g., species")

        train_btn = st.button("⚡ Start Training", use_container_width=True, type="primary")

    if train_btn:
        if not file_name or not target_column:
            st.warning("Please provide both a filename and a target column.")
        else:
            try:
                with st.status("Training models...", expanded=True) as status:
                    st.write("🔧 Cleaning data and preparing features...")
                    data = {"file_name": file_name, "target_column": target_column}

                    st.write("📊 Training Logistic Regression, Random Forest, and Gradient Boosting...")
                    response = requests.post(f"{BACKEND_URL}/train", data=data)

                    if response.status_code == 200 and response.json().get("status") == "Success":
                        status.update(label="Training complete", state="complete", expanded=False)
                        res = response.json()
                        st.balloons()

                        summary = res["training_summary"]

                        m1, m2 = st.columns(2)
                        with m1:
                            st.metric(label="🏆 Best model", value=summary["best_model"])
                        with m2:
                            st.metric(label="🎯 Accuracy", value=f"{summary['accuracy']:.2%}")

                        st.success("Model saved and ready for predictions.")
                        st.code(f"Saved to: {summary['saved_at']}", language="bash")
                    else:
                        status.update(label="Training failed", state="error")
                        st.error("Something went wrong. Double-check your filename and column name.")
            except Exception as e:
                st.error(f"Couldn't reach the backend: {e}")

# --- TAB 3: PREDICTIONS ---
with tab3:
    st.subheader("Make a prediction")
    st.caption("Send a sample to a trained model and see what it predicts.")

    col_input, col_output = st.columns([2, 2], gap="large")

    with col_input:
        with st.container(border=True):
            model_file = st.text_input("Model file", placeholder="e.g., iris_RandomForest.pkl")
            feature_input = st.text_area(
                "Input data (JSON)",
                value='{\n  "sepal_length": 5.1,\n  "sepal_width": 3.5,\n  "petal_length": 1.4,\n  "petal_width": 0.2\n}',
                height=180
            )
            predict_btn = st.button("🔮 Predict", use_container_width=True, type="primary")

    with col_output:
        if predict_btn and model_file and feature_input:
            try:
                parsed_json = json.loads(feature_input)
                response = requests.post(f"{BACKEND_URL}/predict", data={"model_filename": model_file}, json=parsed_json)

                if response.status_code == 200:
                    res = response.json()
                    if res["status"] == "Success":
                        st.markdown("**Result**")
                        r1, r2 = st.columns(2)
                        with r1:
                            st.metric(label="Prediction", value=str(res['inference']['prediction']))
                        with r2:
                            st.metric(label="Confidence", value=f"{res['inference']['confidence']:.2%}")
                        st.toast("Prediction complete!", icon="🎯")
                    else:
                        st.error(res["detail"])
                else:
                    st.error("The backend couldn't process this request. Check your inputs.")
            except json.JSONDecodeError:
                st.error("That input isn't valid JSON — check for missing quotes or commas.")
        else:
            st.info("Enter a model file and input data, then click **Predict**.")
