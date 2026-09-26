// Keeps each feature row's dots in step with the swipe, and lets a dot jump
// to its item.
document.querySelectorAll('.f-row').forEach(function (row) {
  var dots = row.parentNode.querySelector('.f-dots');
  if (!dots) return;
  var items = row.querySelectorAll('.f-item');
  dots.innerHTML = [].map.call(items, function (_, i) {
    return '<button type="button" aria-label="Show ' + (i + 1) + ' of ' + items.length + '" aria-current="' + (i === 0) + '"></button>';
  }).join('');
  var buttons = dots.querySelectorAll('button');
  function step() { return items[0].offsetWidth + parseFloat(getComputedStyle(row).columnGap || 12); }
  row.addEventListener('scroll', function () {
    var i = Math.round(row.scrollLeft / step());
    if (row.scrollLeft + row.clientWidth >= row.scrollWidth - 4) i = items.length - 1;
    buttons.forEach(function (b, k) { b.setAttribute('aria-current', String(k === i)); });
  }, { passive: true });
  buttons.forEach(function (b, i) {
    b.addEventListener('click', function () { row.scrollTo({ left: i * step(), behavior: 'smooth' }); });
  });
});
