import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Database, ArrowRight, ArrowLeft, Check, Play, Upload, Settings2, Target, Cpu, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewExperimentWizardModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [selectedDataset, setSelectedDataset] = useState('customer_churn.csv');
  const [problemType, setProblemType] = useState('Classification');
  const [targetColumn, setTargetColumn] = useState('churn');
  const [trainingTime, setTrainingTime] = useState('Balanced');
  const [metric, setMetric] = useState('Accuracy');
  const [selectedModels, setSelectedModels] = useState(['Random Forest', 'XGBoost', 'LightGBM']);

  if (!isOpen) return null;

  const toggleModel = (m: string) => {
    if (selectedModels.includes(m)) {
      if (selectedModels.length > 1) {
        setSelectedModels(selectedModels.filter((item) => item !== m));
      }
    } else {
      setSelectedModels([...selectedModels, m]);
    }
  };

  const handleStartExperiment = () => {
    onClose();
    navigate('/app/training');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Create New Experiment</h2>
              <p className="text-xs text-zinc-400">Step {step} of 4 — {step === 1 ? 'Choose Dataset' : step === 2 ? 'Problem Type' : step === 3 ? 'Target Column' : 'AutoML Config'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="flex border-b border-zinc-800/80 bg-zinc-950/60">
          {['Dataset', 'Problem Type', 'Target & Features', 'AutoML Config'].map((label, idx) => {
            const stepNum = idx + 1;
            const active = step === stepNum;
            const completed = step > stepNum;
            return (
              <div
                key={label}
                className={`flex-1 py-2.5 px-3 text-center text-xs font-mono border-b-2 transition-colors ${
                  active
                    ? 'border-indigo-500 text-indigo-400 font-semibold bg-indigo-500/5'
                    : completed
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-zinc-500'
                }`}
              >
                {completed ? '✓ ' : `${stepNum}. `} {label}
              </div>
            );
          })}
        </div>

        {/* Step Body */}
        <div className="p-6 min-h-[300px] flex flex-col justify-between">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-200">Select Dataset for Experiment</h3>
              <div className="grid grid-cols-2 gap-3">
                {['customer_churn.csv', 'housing_prices.csv', 'iris_sample.csv', 'loan_data.csv'].map((ds) => (
                  <div
                    key={ds}
                    onClick={() => setSelectedDataset(ds)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                      selectedDataset === ds
                        ? 'bg-indigo-500/10 border-indigo-500/60 text-white'
                        : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <Database className={`w-5 h-5 ${selectedDataset === ds ? 'text-indigo-400' : 'text-zinc-500'}`} />
                    <span className="text-xs font-mono font-medium">{ds}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-200">Select Machine Learning Problem Type</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Classification', desc: 'Predict categorical labels (churn, fraud, iris species)' },
                  { name: 'Regression', desc: 'Predict continuous numerical targets (prices, sales)' },
                  { name: 'Clustering', desc: 'Unsupervised grouping & segment discovery' },
                  { name: 'Time Series', desc: 'Sequential temporal trend forecasting' },
                ].map((pt) => (
                  <div
                    key={pt.name}
                    onClick={() => setProblemType(pt.name)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      problemType === pt.name
                        ? 'bg-indigo-500/10 border-indigo-500/60 text-white'
                        : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-semibold text-zinc-200 mb-1">{pt.name}</div>
                    <p className="text-[11px] text-zinc-400 leading-tight">{pt.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-200">Configure Target Column & Input Features</h3>
              <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800">
                <label className="text-xs font-mono text-zinc-400 block mb-1">Target Column:</label>
                <select
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:outline-none"
                >
                  <option value="churn">churn (Categorical / Binary)</option>
                  <option value="monthly_charges">monthly_charges (Continuous)</option>
                  <option value="tenure">tenure (Integer)</option>
                </select>
              </div>

              <div>
                <span className="text-xs font-mono text-zinc-400 block mb-2">Input Features Selected:</span>
                <div className="flex flex-wrap gap-2">
                  {['age', 'tenure', 'contract_type', 'monthly_charges', 'tech_support', 'total_charges'].map((feat) => (
                    <span key={feat} className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-200">AutoML Training Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1.5">Optimization Metric:</label>
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Accuracy">Accuracy</option>
                    <option value="F1 Score">F1 Score</option>
                    <option value="Precision">Precision</option>
                    <option value="Recall">Recall</option>
                    <option value="ROC-AUC">ROC-AUC</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1.5">Training Time Budget:</label>
                  <div className="flex gap-2">
                    {['Fast', 'Balanced', 'Maximum'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTrainingTime(t)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          trainingTime === t
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-2">Model Algorithms to Benchmark:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Random Forest', 'XGBoost', 'LightGBM', 'Logistic Regression', 'SVM', 'Decision Tree'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleModel(m)}
                      className={`p-2 rounded-lg border text-xs font-mono text-left transition-colors ${
                        selectedModels.includes(m)
                          ? 'bg-indigo-500/10 border-indigo-500/60 text-indigo-300 font-semibold'
                          : 'bg-zinc-950/40 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      {selectedModels.includes(m) ? '✓ ' : ''} {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80 mt-4">
            <button
              onClick={() => step > 1 && setStep(step - 1)}
              disabled={step === 1}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1 transition-colors ${
                step === 1
                  ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleStartExperiment}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black transition-colors shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start AutoML Experiment</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
