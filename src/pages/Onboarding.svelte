<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { onboardingComplete } from '../lib/stores.js'

  const dispatch = createEventDispatcher()

  let step = 1
  let deferredPrompt = null
  let canInstall = false

  onMount(() => {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault()
      deferredPrompt = e
      canInstall = true
    })
  })

  async function installApp() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    canInstall = false
    if (outcome === 'accepted') step = 2
  }

  function continueInBrowser() {
    step = 2
  }

  function getStarted() {
    onboardingComplete.set(true)
    dispatch('complete')
  }
</script>

<div class="onboarding">
  {#if step === 1}
    <div class="step fade-in">
      <div class="logo">🎬</div>
      <h1>Welcome to My Top 50</h1>
      <p class="subtitle">Track your favorite films and get notified when they hit streaming.</p>

      {#if canInstall}
        <div class="install-card">
          <h2>Install the App</h2>
          <p>Add to your home screen for the best experience — works offline and loads instantly.</p>
          <button class="btn-primary" on:click={installApp}>📲 Install App</button>
          <button class="btn-ghost" on:click={continueInBrowser}>Continue in Browser</button>
        </div>
      {:else}
        <button class="btn-primary" on:click={continueInBrowser}>Get Started</button>
        <p class="install-hint">To install: use your browser's "Add to Home Screen" option.</p>
      {/if}
    </div>

  {:else}
    <div class="step fade-in">
      <div class="logo">⭐</div>
      <h1>How it works</h1>

      <div class="features">
        <div class="feature">
          <span class="feature-icon">🔍</span>
          <div>
            <strong>Build your list</strong>
            <p>Search or browse top-rated films and add up to 50 favorites.</p>
          </div>
        </div>
        <div class="feature">
          <span class="feature-icon">📺</span>
          <div>
            <strong>Pick your services</strong>
            <p>Tell us which streaming services you subscribe to.</p>
          </div>
        </div>
        <div class="feature">
          <span class="feature-icon">🔔</span>
          <div>
            <strong>Get notified</strong>
            <p>We'll alert you whenever one of your favorites becomes available to stream.</p>
          </div>
        </div>
      </div>

      <p class="privacy-note">🔒 All data stays on your device. Nothing is sent to any server.</p>

      <button class="btn-primary" on:click={getStarted}>Let's Go →</button>
    </div>
  {/if}
</div>

<style>
  .onboarding {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    background: var(--bg);
  }

  .step {
    max-width: 480px;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }

  .fade-in {
    animation: fadeIn 0.4s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .logo {
    font-size: 4rem;
    line-height: 1;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    margin: 0;
    max-width: 360px;
  }

  .install-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    text-align: left;
  }

  .install-card h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
  }

  .install-card p {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0;
  }

  .features {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: left;
  }

  .feature {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1rem;
  }

  .feature-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .feature strong {
    display: block;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .feature p {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0;
  }

  .privacy-note {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0;
  }

  .install-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0;
  }

  .btn-primary {
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary:hover { background: #c73550; }

  .btn-ghost {
    width: 100%;
    padding: 0.65rem 1.5rem;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.9rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .btn-ghost:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }
</style>
