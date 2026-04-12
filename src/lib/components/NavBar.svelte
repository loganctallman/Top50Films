<script>
  import { location, push } from 'svelte-spa-router'

  let menuOpen = false

  const navItems = [
    { path: '/',              label: 'Home' },
    { path: '/notifications', label: 'Notifications' },
    { path: '/my-list',       label: 'My List' },
    { path: '/add',           label: 'Add to List' },
    { path: '/trials',        label: 'Free Trial Tracker' },
    { path: '/settings',      label: 'Settings' },
  ]

  function navigate(path) {
    push(path)
    menuOpen = false
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') menuOpen = false
  }

  $: currentPath = $location
</script>

<svelte:window on:keydown={handleKeydown} />

<nav class="navbar" aria-label="Main navigation">
  <div class="navbar-inner">
    <a class="brand" href="#/" on:click|preventDefault={() => navigate('/')}>
      🎬 My Top 50
    </a>

    <!-- Desktop nav -->
    <ul class="nav-links desktop-only" role="list">
      {#each navItems as item}
        <li>
          <a
            href="#{item.path}"
            class:active={currentPath === item.path}
            on:click|preventDefault={() => navigate(item.path)}
          >
            {item.label}
          </a>
        </li>
      {/each}
    </ul>

    <!-- Mobile hamburger -->
    <button
      class="hamburger mobile-only"
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={menuOpen}
      on:click={() => menuOpen = !menuOpen}
    >
      <span></span><span></span><span></span>
    </button>
  </div>

  <!-- Mobile dropdown -->
  {#if menuOpen}
    <div class="mobile-menu" role="menu">
      {#each navItems as item}
        <a
          href="#{item.path}"
          class="mobile-menu-item"
          class:active={currentPath === item.path}
          role="menuitem"
          on:click|preventDefault={() => navigate(item.path)}
        >
          {item.label}
        </a>
      {/each}
    </div>
  {/if}
</nav>

<style>
  .navbar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }

  .navbar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    height: 56px;
  }

  .brand {
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--text-primary);
    text-decoration: none;
    letter-spacing: -0.02em;
  }

  .nav-links {
    display: flex;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .nav-links a {
    display: block;
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius);
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    transition: color 0.15s, background 0.15s;
  }

  .nav-links a:hover,
  .nav-links a.active {
    color: var(--text-primary);
    background: var(--surface-elevated);
  }

  .nav-links a.active {
    color: var(--accent);
  }

  .hamburger {
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
  }

  .hamburger span {
    display: block;
    width: 22px;
    height: 2px;
    background: var(--text-primary);
    border-radius: 2px;
    transition: background 0.15s;
  }

  .mobile-menu {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }

  .mobile-menu-item {
    padding: 0.875rem 1.25rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9375rem;
    border-bottom: 1px solid var(--border);
    transition: background 0.15s, color 0.15s;
  }

  .mobile-menu-item:hover,
  .mobile-menu-item.active {
    background: var(--surface-elevated);
    color: var(--text-primary);
  }

  .mobile-menu-item.active {
    color: var(--accent);
  }

  .desktop-only { display: flex; }
  .mobile-only  { display: none; }

  @media (max-width: 768px) {
    .desktop-only { display: none; }
    .mobile-only  { display: flex; }
  }
</style>
