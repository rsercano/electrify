var VERSION = '2.1.4';

Package.describe({
  name: 'mongoclient:electrify',
  version: VERSION,
  summary: 'A fork of electrify for mongoclient',
  git: 'https://github.com/rsercano/electrify',
  documentation: 'README.md'
});

Npm.depends({
  'sockjs-client': '1.0.3'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');

  api.use('random');

  // TODO: change this static version for a  browserified version of
  // the npm module informed inside Npm.depends() above
  api.addFiles('meteor/vendors/sockjs-client.js', ['client'], {bare: true});
  api.addFiles('meteor/index.js', ['server', 'client']);
  
  api.export('Electrify');
});