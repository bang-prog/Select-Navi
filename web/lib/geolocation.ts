export function describeGeolocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "位置情報の利用が許可されていません。ブラウザのアドレスバー付近の設定から位置情報を「許可」にしてください。";
    case err.POSITION_UNAVAILABLE:
      return "現在地を取得できませんでした。OS側の位置情報サービスがオフになっていないか確認してください（Windowsの場合：設定＞プライバシーとセキュリティ＞位置情報）。";
    case err.TIMEOUT:
      return "位置情報の取得がタイムアウトしました。電波状況の良い場所で再度お試しください。";
    default:
      return `位置情報の取得に失敗しました（コード: ${err.code}）`;
  }
}
