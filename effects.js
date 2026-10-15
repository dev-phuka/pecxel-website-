// Lightweight UI effects (icons/animations) without changing layout.
// Loaded by style.css/HTML where desired.

(function(){
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(() => {
    // Add scroll reveal for elements with .reveal
    const reveals = Array.from(document.querySelectorAll('.reveal'));

    // Animate cards on scroll
    const cards = Array.from(document.querySelectorAll('.card, .blog-card'));

    // Nothing to do
    if(!cards.length && !reveals.length) return;

    const io = new IntersectionObserver((entries) => {
      for(const e of entries){
        if(!e.isIntersecting) continue;

        // Reveal behavior
        if(e.target.classList.contains('reveal')){
          e.target.classList.add('active');
          io.unobserve(e.target);
          continue;
        }

        // Card fade-in behavior
        e.target.classList.add('bb-fade-in');
        io.unobserve(e.target);
      }
    }, { threshold: 0.15 });

    if(prefersReduced){
      // Disable motion: show everything immediately
      cards.forEach(c => c.style.transform = 'none');
      reveals.forEach(r => r.classList.add('active'));
    } else {
      cards.forEach(c => {
        c.classList.add('bb-anim-ready');
        io.observe(c);
      });

      reveals.forEach(r => {
        // Ensure initial state exists even if CSS wasn't loaded yet
        r.classList.remove('active');
        io.observe(r);
      });
    }

    // Add subtle "pulse" animation to hero tags
    const heroTags = document.querySelector('.hero-tags');
    if(heroTags && !prefersReduced){
      heroTags.classList.add('bb-hero-tags-anim');
    }
  });
})();


