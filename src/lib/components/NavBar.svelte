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

  function handleWindowClick(e) {
    if (!e.target.closest('.navbar')) menuOpen = false
  }

  $: currentPath = $location
</script>

<svelte:window on:keydown={handleKeydown} on:click={handleWindowClick} />

<nav class="navbar" aria-label="Main navigation">
  <div class="navbar-inner">

    <!-- Left: hamburger -->
    <button
      class="nav-icon-btn hamburger"
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={menuOpen}
      on:click|stopPropagation={() => menuOpen = !menuOpen}
    >
      {#if menuOpen}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      {:else}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      {/if}
    </button>

    <!-- Center: logo -->
    <a
      class="brand"
      href="#/"
      on:click|preventDefault={() => navigate('/')}
      aria-label="My Top 50 — Home"
    >
      <img src="/cutoutlogonotext.png" alt="My Top 50" class="brand-logo" />
    </a>

    <!-- Right: search -->
    <button
      class="nav-icon-btn search-btn"
      aria-label="Search films"
      on:click={() => navigate('/add')}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" stroke-width="2"/>
        <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

  </div>

  <!-- Dropdown menu -->
  {#if menuOpen}
    <div class="nav-menu" role="menu">
      {#each navItems as item}
        <a
          href="#{item.path}"
          class="nav-menu-item"
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
    background: rgba(9, 9, 26, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(201, 168, 76, 0.2);
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
  }

  .navbar-inner {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    height: 72px;
  }

  /* Left slot */
  .hamburger { justify-self: start; }

  /* Center slot */
  .brand {
    justify-self: center;
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  .brand-logo {
    height: 54px;
    width: auto;
    display: block;
    /* preserve transparency */
    filter: drop-shadow(0 2px 8px rgba(201, 168, 76, 0.25));
  }

  /* Right slot */
  .search-btn { justify-self: end; }

  /* Shared icon button style */
  .nav-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: none;
    border: none;
    border-radius: var(--radius);
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
  }

  .nav-icon-btn:hover {
    color: var(--accent);
    background: rgba(201, 168, 76, 0.1);
  }

  /* Dropdown menu */
  .nav-menu {
    background: rgba(9, 9, 26, 0.97);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid rgba(201, 168, 76, 0.15);
    border-bottom: 1px solid rgba(201, 168, 76, 0.15);
  }

  .nav-menu-item {
    display: block;
    padding: 0.9rem 1.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9375rem;
    border-bottom: 1px solid rgba(201, 168, 76, 0.08);
    transition: background 0.15s, color 0.15s;
  }

  .nav-menu-item:last-child {
    border-bottom: none;
  }

  .nav-menu-item:hover {
    background: rgba(201, 168, 76, 0.07);
    color: var(--text-primary);
    text-decoration: none;
  }

  .nav-menu-item.active {
    color: var(--accent);
    font-weight: 600;
  }
</style>
