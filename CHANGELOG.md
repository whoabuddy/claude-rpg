# Changelog

## [1.8.0](https://github.com/whoabuddy/claude-rpg/compare/v1.7.0...v1.8.0) (2026-01-28)


### Features

* resolve all 11 open issues ([#89](https://github.com/whoabuddy/claude-rpg/issues/89)-99) ([#103](https://github.com/whoabuddy/claude-rpg/issues/103)) ([e223db7](https://github.com/whoabuddy/claude-rpg/commit/e223db75665a50a83ec57050993168344fe203e7))

## [1.7.0](https://github.com/whoabuddy/claude-rpg/compare/v1.6.1...v1.7.0) (2026-01-27)


### Features

* add quest tracking with server, data model, and UI ([#76](https://github.com/whoabuddy/claude-rpg/issues/76)) ([17bb494](https://github.com/whoabuddy/claude-rpg/commit/17bb494094c5a582002e976baf1986b965b75470))
* **ui:** game HUD button layouts & responsive design ([#74](https://github.com/whoabuddy/claude-rpg/issues/74)) ([80e9625](https://github.com/whoabuddy/claude-rpg/commit/80e9625f9b85f7ce8f88aca87ce63a3aeb737082))


### Bug Fixes

* usability bugs and UI polish ([#66](https://github.com/whoabuddy/claude-rpg/issues/66), [#67](https://github.com/whoabuddy/claude-rpg/issues/67), [#68](https://github.com/whoabuddy/claude-rpg/issues/68), [#77](https://github.com/whoabuddy/claude-rpg/issues/77), [#78](https://github.com/whoabuddy/claude-rpg/issues/78)) ([#79](https://github.com/whoabuddy/claude-rpg/issues/79)) ([d5c672a](https://github.com/whoabuddy/claude-rpg/commit/d5c672a5a4f963337a826b421f0ae05c86cd699d))

## [1.6.1](https://github.com/whoabuddy/claude-rpg/compare/v1.6.0...v1.6.1) (2026-01-26)


### Bug Fixes

* add missing features to FullScreenPane and slim down PaneCard ([76b0a6f](https://github.com/whoabuddy/claude-rpg/commit/76b0a6f0e64357dce6162c04768ddbb895ff73e5))
* wire ActionButton into PaneCard, use StatusIndicator in FullScreenPane ([14cac30](https://github.com/whoabuddy/claude-rpg/commit/14cac3064ad0a025eb045dcbeb926a2fc3e4df67))

## [1.6.0](https://github.com/whoabuddy/claude-rpg/compare/v1.5.0...v1.6.0) (2026-01-26)


### Features

* add window rename with duplicate name prevention ([a4bda83](https://github.com/whoabuddy/claude-rpg/commit/a4bda83d08805a7fecd0b794a5361477738e1d5a))
* resilient prompt sending with last-prompt recovery ([c46feda](https://github.com/whoabuddy/claude-rpg/commit/c46fedaf71a3b8bd3da2ec7e47bd00d52edfee15))


### Bug Fixes

* update hooks setup for new Claude Code matcher format ([8d7ad51](https://github.com/whoabuddy/claude-rpg/commit/8d7ad512de81149432e96cdafc2796671ba6704f))

## [1.5.0](https://github.com/whoabuddy/claude-rpg/compare/v1.4.0...v1.5.0) (2026-01-26)


### Features

* production deploy with dev backend proxy ([a83eff9](https://github.com/whoabuddy/claude-rpg/commit/a83eff9253904771a7a1247e6385a929a2410181))


### Bug Fixes

* correct compiled output paths for dist/server/server/ layout ([4cc9b07](https://github.com/whoabuddy/claude-rpg/commit/4cc9b07af089f5dec97b240baef5508191d108ab))

## [1.4.0](https://github.com/whoabuddy/claude-rpg/compare/v1.3.1...v1.4.0) (2026-01-26)


### Features

* RPG feature flag, terminal reliability, input safety, ANSI rendering ([8c12164](https://github.com/whoabuddy/claude-rpg/commit/8c12164c69d12405a42bded4c05f2f06f6161f3c))
* smart polling with tmux control mode integration ([#57](https://github.com/whoabuddy/claude-rpg/issues/57)) ([1918fe4](https://github.com/whoabuddy/claude-rpg/commit/1918fe4447a11f53ae370a5c9cd76002bf2d2af4))


### Bug Fixes

* disable control mode causing tmux scrollback issues ([852ebc0](https://github.com/whoabuddy/claude-rpg/commit/852ebc0a9693cb95d4aa79c35d4046cac338ea8a))
* optimize re-renders, extract cleanup helper, add disconnect banner ([343ed4d](https://github.com/whoabuddy/claude-rpg/commit/343ed4d75953b7bed69922c0bb84c58ff059b4b7))
* resolve stuck 'working' status by fixing reconciliation timing ([d7f25e5](https://github.com/whoabuddy/claude-rpg/commit/d7f25e5108455f38fc0e17e5a1b75478c19fc397))
* terminal update reliability and mobile layout ([26ea6b6](https://github.com/whoabuddy/claude-rpg/commit/26ea6b674c318a1b0d5681bcbb4d313b779658dd))

## [1.3.1](https://github.com/whoabuddy/claude-rpg/compare/v1.3.0...v1.3.1) (2026-01-23)


### Bug Fixes

* prevent O(n²) startup hang with large event history ([2e7771e](https://github.com/whoabuddy/claude-rpg/commit/2e7771e36c032db1988245b2f515b37437c8d31e))
* resolve memory leaks causing SIGILL after overnight use ([b53cc78](https://github.com/whoabuddy/claude-rpg/commit/b53cc780b7d29946718f1f64fb75153d7ec955f7)), closes [#51](https://github.com/whoabuddy/claude-rpg/issues/51)

## [1.3.0](https://github.com/whoabuddy/claude-rpg/compare/v1.2.0...v1.3.0) (2026-01-23)


### Features

* add create window button and remove pro mode toggle ([1c4aef4](https://github.com/whoabuddy/claude-rpg/commit/1c4aef41e7a837cec5f7c74114ba10150074fd6b))
* add multi-VM deployment scripts ([b281293](https://github.com/whoabuddy/claude-rpg/commit/b281293e6c3f4407b8e9df15b2171ef283a8f8e0))


### Bug Fixes

* improve leaderboard layout and prompt display ([212e05e](https://github.com/whoabuddy/claude-rpg/commit/212e05e90f0755967122bd5287140bf40a10a291))
* show /clear in Prompt field when session is cleared ([1759ef6](https://github.com/whoabuddy/claude-rpg/commit/1759ef64eee7dea0f4147a07dcd16dd911d8bc58))
* use full event history for competition stats ([6be7868](https://github.com/whoabuddy/claude-rpg/commit/6be7868a657c8e431e4a3631c8cf95671450b54e)), closes [#49](https://github.com/whoabuddy/claude-rpg/issues/49)

## [1.2.0](https://github.com/whoabuddy/claude-rpg/compare/v1.1.0...v1.2.0) (2026-01-22)


### Features

* terminal-first prompt detection for permission and question prompts ([854c2fa](https://github.com/whoabuddy/claude-rpg/commit/854c2fac5b680dfb445c159cb18a2e4b8bdc9b9c))

## [1.1.0](https://github.com/whoabuddy/claude-rpg/compare/v1.0.2...v1.1.0) (2026-01-22)


### Features

* add tmux pane management controls (split, close, start-claude) ([d8066d5](https://github.com/whoabuddy/claude-rpg/commit/d8066d5bf071bac18b8d5c5342be47eff64cca97)), closes [#1](https://github.com/whoabuddy/claude-rpg/issues/1)


### Bug Fixes

* make pane management buttons mobile-friendly ([029c885](https://github.com/whoabuddy/claude-rpg/commit/029c88562efc8d9d7898897fb609c2748c52ad31))

## [1.0.2](https://github.com/whoabuddy/claude-rpg/compare/v1.0.1...v1.0.2) (2026-01-22)


### Bug Fixes

* correct session status after /clear and improve mobile GitHub links ([#42](https://github.com/whoabuddy/claude-rpg/issues/42), [#41](https://github.com/whoabuddy/claude-rpg/issues/41)) ([734277b](https://github.com/whoabuddy/claude-rpg/commit/734277b5ec5c9913c9736b0d203d66fad56fd334))

## [1.0.1](https://github.com/whoabuddy/claude-rpg/compare/v1.0.0...v1.0.1) (2026-01-21)


### Bug Fixes

* prevent false notifications and make button widths consistent ([#38](https://github.com/whoabuddy/claude-rpg/issues/38), [#39](https://github.com/whoabuddy/claude-rpg/issues/39)) ([70ef26e](https://github.com/whoabuddy/claude-rpg/commit/70ef26e2aabbf54ac4ce2fcd8d11b00eb915dd75))
* show server connection error instead of misleading tmux message ([86324cf](https://github.com/whoabuddy/claude-rpg/commit/86324cfe20111b31fe5c573ba27693c4f9b82a66))
