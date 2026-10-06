import { escapeHTML as h } from '../utils/html.js';
import { renderProductArt } from './artwork.js';
export function productMedia(product) {
  return product.media?.length
    ? product.media
    : product.imageUrl
      ? [{ type: 'image', url: product.imageUrl, primary: true }]
      : [];
}
export function galleryHTML(product) {
  const items = productMedia(product);
  const media = [...items.filter((item) => item.primary), ...items.filter((item) => !item.primary)];
  if (!media.length)
    return `<div class="productart" style="--bg:${product.bg}">${renderProductArt(product, 'detail')}</div>`;
  return `<section class="product-gallery" aria-label="Ảnh và video sản phẩm">
    <div class="gallery-stage">
      <div class="gallery-track" tabindex="0" aria-label="Vuốt hoặc dùng phím mũi tên để xem ảnh và video">
        ${media.map((item, i) => `<div class="gallery-slide" role="group" aria-label="${i + 1} / ${media.length}">${item.type === 'video' ? `<video controls playsinline preload="metadata" src="${h(item.url)}" aria-label="Video ${i + 1} của ${product.name}"></video>` : `<img src="${h(item.url)}" alt="${product.name} — ảnh ${i + 1}" ${i ? 'loading="lazy"' : ''} draggable="false">`}</div>`).join('')}
      </div>
      ${media.length > 1 ? '<button type="button" class="gallery-arrow gallery-prev" aria-label="Ảnh trước">‹</button><button type="button" class="gallery-arrow gallery-next" aria-label="Ảnh tiếp theo">›</button>' : ''}
      <span class="gallery-count" aria-live="polite">1 / ${media.length}</span>
    </div>
    <div class="gallery-thumbnails" aria-label="Chọn ảnh hoặc video">${media.map((item, i) => `<button type="button" data-slide="${i}" aria-label="Xem ${item.type === 'video' ? 'video' : 'ảnh'} ${i + 1}" aria-pressed="${i === 0}">${item.type === 'image' ? `<img src="${h(item.url)}" alt="" loading="lazy">` : '<span aria-hidden="true">▶</span><small>Video</small>'}</button>`).join('')}</div>
  </section>`;
}
export function initGallery(root, dialog) {
  const track = root.querySelector('.gallery-track');
  if (!track) return;
  const buttons = [...root.querySelectorAll('[data-slide]')];
  let current = 0;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function select(index) {
    const next = Math.max(0, Math.min(buttons.length - 1, index));
    track.scrollTo({ left: next * track.clientWidth, behavior: reduced() ? 'instant' : 'smooth' });
  }
  track.addEventListener(
    'scroll',
    () => {
      if (!track.clientWidth) return;
      const index = Math.round(track.scrollLeft / track.clientWidth);
      if (index === current) return;
      current = index;
      track.querySelectorAll('video').forEach((video) => video.pause());
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
      const thumbs = root.querySelector('.gallery-thumbnails');
      const active = buttons[current];
      if (active)
        thumbs.scrollTo({
          left: Math.max(
            0,
            active.offsetLeft - thumbs.offsetLeft - thumbs.clientWidth / 2 + active.clientWidth / 2,
          ),
          behavior: reduced() ? 'instant' : 'smooth',
        });
      root.querySelector('.gallery-count').textContent = `${current + 1} / ${buttons.length}`;
      const prev = root.querySelector('.gallery-prev'),
        next = root.querySelector('.gallery-next');
      if (prev) prev.disabled = current === 0;
      if (next) next.disabled = current === buttons.length - 1;
    },
    { passive: true },
  );
  buttons.forEach((button, i) => (button.onclick = () => select(i)));
  const prev = root.querySelector('.gallery-prev'),
    next = root.querySelector('.gallery-next');
  if (prev) {
    prev.disabled = true;
    prev.onclick = () => select(current - 1);
  }
  if (next) next.onclick = () => select(current + 1);
  track.onkeydown = (event) => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    select(current + (event.key === 'ArrowRight' ? 1 : -1));
  };
  let width = track.clientWidth;
  const resize = new ResizeObserver(() => {
    if (track.clientWidth === width) return;
    width = track.clientWidth;
    if (width) track.scrollTo({ left: current * track.clientWidth, behavior: 'instant' });
  });
  resize.observe(track);
  dialog.addEventListener(
    'close',
    () => {
      track.querySelectorAll('video').forEach((video) => video.pause());
      resize.disconnect();
    },
    { once: true },
  );
}
