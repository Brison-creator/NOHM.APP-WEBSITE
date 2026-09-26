// "Download now" goes to the right store for the phone in hand; iPhones
// and computers get the App Store, which is the links' default.
if (/android/i.test(navigator.userAgent)) {
  document.querySelectorAll('.cta, [data-download]').forEach(function (a) {
    a.href = 'https://play.google.com/store/apps/details?id=com.nohm.app';
  });
}
