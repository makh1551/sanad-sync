// يعمل داخل موقع التقويم: يستلم مفتاح المزامنة من لوحة إدارة سند عند ضغط «اربط أداة هذا المتصفح»
(function () {
  const ORIGIN = 'https://taqweem.wasl.uk';
  const hello = () => window.postMessage({ type: 'sanad-ext', version: chrome.runtime.getManifest().version }, ORIGIN);
  window.addEventListener('message', e => {
    if (e.source !== window || e.origin !== ORIGIN) return;
    const m = e.data || {};
    if (m.type === 'sanad-ping') return hello();
    if (m.type !== 'sanad-pair' || !/^[a-f0-9]{32,64}$/.test(m.key || '')) return;
    chrome.storage.local.set({ device: m.key, deviceName: String(m.name || '').slice(0, 40) }, () => {
      chrome.storage.local.remove('pin');
      window.postMessage({ type: 'sanad-paired', version: chrome.runtime.getManifest().version }, ORIGIN);
    });
  });
  hello();
})();
