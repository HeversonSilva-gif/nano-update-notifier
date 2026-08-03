// `export =`, so the types hang off the same name and a CommonJS consumer reaches them as
// `updateNotifier.Package`. Aliased from `./index.js`: one source, no drift.
import type * as t from "./index.js";

declare function updateNotifier(options?: t.Options): t.UpdateNotifier;

declare namespace updateNotifier {
  type Spacing = t.Spacing;
  type BorderStyle = t.BorderStyle;
  type BoxOptions = t.BoxOptions;
  type Update = t.Update;
  type PackageInformation = t.PackageInformation;
  type Options = t.Options;
  type NotifyOptions = t.NotifyOptions;
  type ConfigStore = t.ConfigStore;
  type UpdateNotifier = t.UpdateNotifier;
  type Package = t.Package;
  type Settings = t.Settings;
  type UpdateInfo = t.UpdateInfo;
}

export = updateNotifier;
