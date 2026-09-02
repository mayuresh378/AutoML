import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import { TextReveal, ScrollReveal, GlowOrb, MagneticButton } from '../components/motion';
import styles from './Landing.module.css';

const FEATURES = [
  {
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    title: 'Automated ML',
    desc: 'End-to-end pipeline automation from data ingestion to model deployment with zero manual intervention.',
  },
  {
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    title: 'Explainable AI',
    desc: 'State-of-the-art interpretability tools that make every model decision transparent and auditable.',
  },
  {
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    title: 'Real-time Inference',
    desc: 'Deploy models as blazing-fast REST APIs with automatic scaling, monitoring, and version management.',
  },
  {
    icon: 'M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M12 3v12m0 0l-4-4m4 4l4-4',
    title: 'Data Integration',
    desc: 'Connect to any data source — SQL, S3, BigQuery, Snowflake — with smart schema detection and cleaning.',
  },
  {
    icon: 'M12 8V4m0 0L8 8m4-4l4 4M12 16v4m0 0l-4-4m4 4l4-4M4 12H2m2 0h4m8 0h4m-4 0h-2m-8 0H6',
    title: 'Experiment Tracking',
    desc: 'Log, compare, and reproduce thousands of experiments with rich metadata and visual comparisons.',
  },
  {
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    title: 'Model Registry',
    desc: 'Centralized model governance with staging/production stages, versioning, and approval workflows.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { scrollYProgress } = useScroll();

  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.96]);
  const previewY = useTransform(scrollYProgress, [0, 0.4], [0, -60]);
  const blobScale = useTransform(scrollYProgress, [0, 0.3], [1, 1.3]);

  return (
    <div className={styles.page}>
      {/* Nav */}
      <motion.nav
        className={styles.nav}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.1 }}
      >
        <div className={styles.navInner}>
          <div className={styles.logo}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#111" />
              <path d="M7 12h10M12 7v10" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className={styles.brand}>AutoML</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#pricing" className={styles.navLink}>Pricing</a>
            <a href="#docs" className={styles.navLink}>Docs</a>
            <motion.button
              className={styles.themeBtn}
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              whileHover={{ scale: 1.1, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
            >
              {isDark ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </motion.button>
            <MagneticButton className={styles.ctaSmall} onClick={() => navigate('/app/dashboard')} strength={0.25}>
              Get started
            </MagneticButton>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <motion.div
          className={styles.heroBg}
          style={{ scale: blobScale }}
        >
          <GlowOrb size={500} color="rgba(255,255,255,0.10)" x={-100} y={-50} delay={0} blur={100} />
          <GlowOrb size={400} color="rgba(255,255,255,0.07)" x={400} y={100} delay={5} blur={100} />
          <GlowOrb size={350} color="rgba(255,255,255,0.05)" x={200} y={300} delay={10} blur={80} />
        </motion.div>

        <motion.div
          className={styles.heroContent}
          style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
        >
          <motion.div
            className={styles.badge}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          >
            Now in Public Beta
          </motion.div>

          <TextReveal
            as="h1"
            className={styles.heroTitle}
            delay={0.3}
            speed={0.03}
            charMode="words"
          >
            Build, deploy, and monitor machine learning at scale
          </TextReveal>

          <ScrollReveal delay={0.6} direction="up" distance={20}>
            <p className={styles.heroDesc}>
              The unified platform for the complete ML lifecycle — from data preparation to
              production monitoring. No infrastructure headaches. No vendor lock-in.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.7} direction="up" distance={20}>
            <div className={styles.heroActions}>
              <MagneticButton className={styles.btnPrimary} onClick={() => navigate('/app/dashboard')} strength={0.2}>
                Start building
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </MagneticButton>
              <motion.button className={styles.btnGhost} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                Watch demo
              </motion.button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.8} direction="fade">
            <p className={styles.heroFootnote}>No credit card required. Free tier included.</p>
          </ScrollReveal>
        </motion.div>

        {/* Dashboard Preview */}
        <motion.div
          className={styles.preview}
          style={{ y: previewY }}
          initial={{ opacity: 0, y: 60, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.previewFrame}>
            <div className={styles.previewHeader}>
              <div className={styles.previewDots}>
                <span /><span /><span />
              </div>
              <div className={styles.previewUrl}>app.automl.dev/dashboard</div>
            </div>
            <div className={styles.previewBody}>
              <div className={styles.previewChart}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitle} />
                  <div className={styles.chartMeta} />
                </div>
                <div className={styles.chartBars}>
                  <div className={styles.barGroup}>
                    {[60, 85, 45, 92, 70, 55].map((h, i) => (
                      <motion.div
                        key={i}
                        className={styles.bar}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{
                          delay: 0.8 + i * 0.08,
                          type: 'spring',
                          stiffness: 100,
                          damping: 12,
                        }}
                      />
                    ))}
                  </div>
                  <div className={styles.barGroup}>
                    {[40, 70, 30, 80, 55, 35].map((h, i) => (
                      <motion.div
                        key={i}
                        className={`${styles.bar} ${styles.barSecondary}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{
                          delay: 0.9 + i * 0.08,
                          type: 'spring',
                          stiffness: 100,
                          damping: 12,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.previewMetrics}>
                {['Accuracy', 'Precision', 'Recall', 'F1'].map((m, i) => (
                  <motion.div
                    key={m}
                    className={styles.metric}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 + i * 0.1, type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <span className={styles.metricValue}>
                      {(94 + Math.random() * 5).toFixed(1)}%
                    </span>
                    <span className={styles.metricLabel}>{m}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className={styles.features}>
        <ScrollReveal direction="up" distance={30}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Everything you need for ML</h2>
            <p className={styles.sectionDesc}>
              From raw data to production models — a single, cohesive platform.
            </p>
          </div>
        </ScrollReveal>
        <div className={styles.featureGrid}>
          {FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 0.05} direction="up" distance={24}>
              <motion.div
                className={styles.featureCard}
                whileHover={{
                  y: -6,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 20px 60px rgba(0,0,0,0.5)',
                  transition: { duration: 0.25 },
                }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  className={styles.featureIcon}
                  whileHover={{ scale: 1.15, rotate: -5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </motion.div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className={styles.stats}>
        <div className={styles.statGrid}>
          {[
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '10K+', label: 'Models Deployed' },
            { value: '500ms', label: 'Avg. Inference' },
            { value: '50+', label: 'Built-in Algorithms' },
          ].map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 0.1} direction="scale">
              <motion.div
                className={styles.stat}
                whileHover={{ scale: 1.05, y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <ScrollReveal direction="scale" distance={0.92}>
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaTitle}>Ready to ship ML faster?</h2>
            <p className={styles.ctaDesc}>
              Join thousands of teams building production ML with AutoML.
            </p>
            <MagneticButton className={styles.btnPrimary} onClick={() => navigate('/app/dashboard')} strength={0.2}>
              Get started free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </MagneticButton>
          </div>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#111" />
              <path d="M7 12h10M12 7v10" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>AutoML Platform</span>
          </div>
          <div className={styles.footerLinks}>
            <span>Docs</span>
            <span>API</span>
            <span>Privacy</span>
            <span>Terms</span>
          </div>
          <span className={styles.footerCopy}>© 2026 AutoML Platform.</span>
        </div>
      </footer>
    </div>
  );
}
