# Phase 0 bridge互換rollback

このbranchは本番bridge候補 `9a9ef35d0d3d029e321057e13684793cc96a8e08` を基準にする。旧本番commit `5a3884d393da7c416313131420713629c93e26ec` は `companyId` をGASへ渡さないため、Phase 0導入後のrollback先に使わない。

本版は本番LIFF IDと本番GAS URLを固定したままroute/companyIdのquery・`liff.state`・Cookie・認証遷移を保持する。不正routeはhomeへ落とし、`companyId`も破棄する。bridgeは公開停止を判定しない。停止はLIFF GASの `TOUR_FORCE_STOP=true` と `TOUR_PUBLIC_ENABLED=false` で実施し、GASが閉鎖案内を返す。

このローカル成果物はPages未公開。使用前に配信先repo、deployment、実配信HTML、GASの公開停止状態を別途照合する。旧予約writerへ迂回しない。
