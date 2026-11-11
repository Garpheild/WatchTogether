# native

Код для нативных клиентов (Android/iOS, React Native, WebView-мосты):
типы событий плеера, адаптеры платформенных API, общие DTO.

Когда понадобится настоящий мобильный клиент — разворачиваем React Native
рядом (`yarn create expo-app native/app` или `npx @react-native-community/cli init`)
и переиспользуем `framework` + `native` через workspace.
