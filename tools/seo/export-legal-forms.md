# Refreshing tools/seo/legal-forms.json

The state form pages (`/landlords/forms/` and `/landlords/forms/<state>/`)
are built from `legal-forms.json`, a copy of the NOHM server's legal forms
catalog: the same forms, words and statutes the app shows. When the server's
forms change, refresh the copy from a checkout of the backend:

```
cd nohm-backend
TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register -r tsconfig-paths/register -e "
const c = require('./src/modules/legal-forms/forms/catalog');
const keep = ['key','groupLabel','label','explain','when','citations','notes','generic','court','sources'];
const states = c.statesIndex().map((s) => {
  const v = c.stateView(c.formSetFor(s.code));
  return { code: v.state.code, name: v.state.name, forms: v.forms.map((f) => Object.fromEntries(keep.map((k) => [k, f[k]]))) };
});
const about = require('<site>/tools/seo/legal-forms.json')._about;
const exported = new Date().toISOString().slice(0, 10); // shown as "Updated" and the sitemap's lastmod
require('fs').writeFileSync('<site>/tools/seo/legal-forms.json', JSON.stringify({ _about: about, _exported: exported, states }, null, 1));
"
```

Then `node tools/seo/build.mjs` and `node --test tools/seo/*.test.mjs tools/site/*.test.mjs`.
