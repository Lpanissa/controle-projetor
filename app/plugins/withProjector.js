// Adiciona ao AndroidManifest: o serviço do controle (notificação) e o
// "Compartilhar com" para receber links de séries dos apps de vídeo.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withProjector(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    app.service = app.service || [];
    const svcName = 'expo.modules.projectornative.ControlService';
    if (!app.service.find((s) => s.$['android:name'] === svcName)) {
      app.service.push({
        $: {
          'android:name': svcName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'connectedDevice',
        },
      });
    }

    const main = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    main['intent-filter'] = main['intent-filter'] || [];
    const hasShare = main['intent-filter'].some((f) =>
      (f.action || []).some((a) => a.$['android:name'] === 'android.intent.action.SEND')
    );
    if (!hasShare) {
      main['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': 'text/plain' } }],
      });
    }
    return cfg;
  });
};
