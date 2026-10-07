import { getSettings, defaultSettings } from '../database.js';
import { text, integer, HttpError } from '../validation.js';
export function registerSettingsRoutes(app, { db }) {
  app.put('/api/admin/settings', (req, res) => {
    const settings = {};
    for (const key of ['name', 'zaloPhone', 'facebookUrl', 'tiktokUrl', 'email', 'phone'])
      settings[key] = text(
        req.body[key] || '',
        key,
        key === 'name' ? 2 : 0,
        key === 'facebookUrl' || key === 'tiktokUrl' ? 500 : 200,
      );
    if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email))
      throw new HttpError(400, 'Email không hợp lệ.');
    if (settings.zaloPhone && !/^0\d{9}$/.test(settings.zaloPhone))
      throw new HttpError(400, 'Số Zalo không hợp lệ.');
    if (settings.phone && !/^\+?\d{9,15}$/.test(settings.phone))
      throw new HttpError(400, 'Số điện thoại không hợp lệ.');
    if (settings.facebookUrl) {
      let u;
      try {
        u = new URL(settings.facebookUrl);
      } catch {
        throw new HttpError(400, 'URL Facebook không hợp lệ.');
      }
      if (
        u.protocol !== 'https:' ||
        ![
          'facebook.com',
          'www.facebook.com',
          'm.facebook.com',
          'fb.com',
          'www.fb.com',
          'm.me',
        ].includes(u.hostname)
      )
        throw new HttpError(400, 'URL Facebook không hợp lệ.');
    }
    if (settings.tiktokUrl) {
      let url;
      try {
        url = new URL(settings.tiktokUrl);
      } catch {
        throw new HttpError(400, 'URL TikTok không hợp lệ.');
      }
      if (
        url.protocol !== 'https:' ||
        ![
          'tiktok.com',
          'www.tiktok.com',
          'm.tiktok.com',
          'vm.tiktok.com',
          'vt.tiktok.com',
        ].includes(url.hostname)
      )
        throw new HttpError(400, 'URL TikTok không hợp lệ.');
    }
    if (typeof req.body.demo !== 'boolean')
      throw new HttpError(400, 'Trạng thái nội dung mẫu không hợp lệ.');
    settings.demo = req.body.demo;
    settings.shippingFee = integer(req.body.shippingFee, 'Phí giao hàng', 0, 1000000);
    settings.freeShippingThreshold = integer(
      req.body.freeShippingThreshold,
      'Ngưỡng miễn phí giao hàng',
    );
    db.prepare('UPDATE settings SET data=? WHERE id=1').run(
      JSON.stringify({ ...defaultSettings, ...settings }),
    );
    res.json(getSettings(db));
  });
}
