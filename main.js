(function () {
  'use strict';

  const TOTAL_FRAMES = 282;
  const FRAME_DIRECTORY = 'ezgif-52b6a8572cd2ed80-jpg';
  const IMAGE_WIDTH = 1920;
  const IMAGE_HEIGHT = 1080;
  const ASPECT_RATIO = IMAGE_WIDTH / IMAGE_HEIGHT;

  // DOM Elements
  const container = document.getElementById('hero-sequence-container');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const overlay = document.getElementById('hero-overlay');
  const navbar = document.getElementById('main-navbar');
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  // Preloaded image references (1-indexed for frame numbers 1 to 282)
  const images = new Array(TOTAL_FRAMES + 1).fill(null);
  const loading = new Array(TOTAL_FRAMES + 1).fill(false);

  // Animation & Interpolation state
  let currentFrameFloat = 0;
  let currentTargetFrame = 0; // 0 to 281
  let lastRenderedFrame = -1;

  // Viewport dimensions
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function getFramePath(frameNumber) {
    const padded = String(frameNumber).padStart(3, '0');
    return `${FRAME_DIRECTORY}/ezgif-frame-${padded}.jpg`;
  }

  // Preload a single frame (1-based index)
  function preloadImage(frameNumber) {
    if (frameNumber < 1 || frameNumber > TOTAL_FRAMES) return Promise.resolve(null);
    if (images[frameNumber] && images[frameNumber].naturalWidth > 0) {
      return Promise.resolve(images[frameNumber]);
    }
    if (loading[frameNumber]) return Promise.resolve(null);

    loading[frameNumber] = true;
    return new Promise((resolve) => {
      const img = new Image();
      img.src = getFramePath(frameNumber);

      img.onload = () => {
        images[frameNumber] = img;
        loading[frameNumber] = false;
        if (Math.abs(Math.round(currentFrameFloat + 1) - frameNumber) <= 1) {
          canvas._needsRedraw = true;
        }
        resolve(img);
      };

      img.onerror = () => {
        loading[frameNumber] = false;
        resolve(null);
      };
    });
  }

  // Preload frames around current target
  function preloadAround(frameNumber) {
    for (let i = -5; i <= 20; i++) {
      const idx = frameNumber + i;
      if (idx >= 1 && idx <= TOTAL_FRAMES && !images[idx] && !loading[idx]) {
        preloadImage(idx);
      }
    }
  }

  // Find nearest loaded frame to guarantee no blank frames or flicker
  function getNearestLoadedImage(preferredNumber) {
    if (images[preferredNumber] && images[preferredNumber].naturalWidth > 0) {
      return images[preferredNumber];
    }

    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = preferredNumber - offset;
      if (prev >= 1 && images[prev] && images[prev].naturalWidth > 0) {
        return images[prev];
      }

      const next = preferredNumber + offset;
      if (next <= TOTAL_FRAMES && images[next] && images[next].naturalWidth > 0) {
        return images[next];
      }
    }
    return null;
  }

  // Resize canvas according to DPR and viewport
  function resizeCanvas() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(viewportWidth * dpr);
    canvas.height = Math.round(viewportHeight * dpr);

    lastRenderedFrame = -1;
    renderFrame(Math.round(currentFrameFloat));
  }

  // Render a specific 0-based frame (0 to 281)
  function renderFrame(targetFrame0Based) {
    const frameNumber = Math.min(Math.max(1, targetFrame0Based + 1), TOTAL_FRAMES);

    const img = getNearestLoadedImage(frameNumber);
    if (!img) return;

    if (frameNumber === lastRenderedFrame && !canvas._needsRedraw) return;
    lastRenderedFrame = frameNumber;
    canvas._needsRedraw = false;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    // Calculate aspect ratio covering
    const screenRatio = viewportWidth / viewportHeight;
    let renderW, renderH, offsetX, offsetY;

    if (screenRatio > ASPECT_RATIO) {
      renderW = viewportWidth;
      renderH = viewportWidth / ASPECT_RATIO;
      offsetX = 0;
      offsetY = (viewportHeight - renderH) / 2;
    } else {
      renderH = viewportHeight;
      renderW = viewportHeight * ASPECT_RATIO;
      offsetX = (viewportWidth - renderW) / 2;
      offsetY = 0;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);

    ctx.restore();
  }

  // Main animation loop using Lerp for buttery smoothness
  function update() {
    const diff = currentTargetFrame - currentFrameFloat;

    if (Math.abs(diff) > 0.01) {
      currentFrameFloat += diff * 0.22;
    } else {
      currentFrameFloat = currentTargetFrame;
    }

    renderFrame(Math.round(currentFrameFloat));
    requestAnimationFrame(update);
  }

  // Calculate scroll progress relative strictly to #hero-sequence-container
  function updateFrameOnScroll() {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const totalScrollable = container.offsetHeight - window.innerHeight;
    const currentScrolled = -rect.top;

    // Calculate 0.0 to 1.0 clamped progress
    const progress = totalScrollable > 0 ? Math.min(Math.max(currentScrolled / totalScrollable, 0), 1) : 0;

    // Map to 282 frames (0 to 281)
    const targetFrame = Math.min(Math.floor(progress * 282), 281);
    currentTargetFrame = targetFrame;
    preloadAround(targetFrame + 1);

    // Fade overlay out during first 20% scroll
    if (overlay) {
      overlay.style.opacity = Math.max(0, 1 - progress * 5);
      overlay.style.pointerEvents = progress > 0.1 ? 'none' : 'auto';
    }

    // Navbar transition past hero
    if (navbar) {
      if (progress >= 0.98) {
        navbar.classList.add('scrolled-past-hero');
      } else {
        navbar.classList.remove('scrolled-past-hero');
      }
    }

    // Highlight active section
    updateActiveNav();
  }

  // Update active nav link based on scroll position
  function updateActiveNav() {
    const sections = ['hero-sequence-container', 'philosophy', 'formats', 'capabilities', 'stories', 'contact'];
    const navLinks = document.querySelectorAll('.nav-link');
    const scrollPos = (window.pageYOffset || document.documentElement.scrollTop || 0) + 200;

    sections.forEach((sectionId) => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      const top = el.offsetTop;
      const height = el.offsetHeight;

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach((link) => {
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }

  // Preloading sequence: fast initial start + background pool
  async function startPreload() {
    // 1. First frame immediately
    const firstImg = await preloadImage(1);
    if (firstImg) {
      canvas._needsRedraw = true;
      renderFrame(0);
    }

    // 2. Initial batch (frames 2 to 35) immediately for silky initial scroll
    const batch = [];
    for (let i = 2; i <= 35; i++) {
      batch.push(preloadImage(i));
    }
    await Promise.all(batch);

    // 3. Background stream remaining frames with concurrency of 8
    const remaining = [];
    for (let i = 36; i <= TOTAL_FRAMES; i++) {
      remaining.push(i);
    }

    const CONCURRENCY = 8;
    let ptr = 0;
    async function worker() {
      while (ptr < remaining.length) {
        const frameIdx = remaining[ptr++];
        await preloadImage(frameIdx);
      }
    }

    const workers = [];
    for (let w = 0; w < CONCURRENCY; w++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  // Mobile menu interactions
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });

    document.querySelectorAll('.mobile-link').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
      });
    });
  }

  // Smooth scroll for internal links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Event Listeners
  window.addEventListener('scroll', updateFrameOnScroll, { passive: true });
  window.addEventListener('resize', resizeCanvas, { passive: true });

  // Initialize
  resizeCanvas();
  updateFrameOnScroll();
  requestAnimationFrame(update);
  startPreload();

})();
