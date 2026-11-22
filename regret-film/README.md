# 人生处处充满遗憾 · 电影感纯音乐视频（Remotion）

成片（1920×1080，30 fps，144.83 s，4345 帧，H.264 + AAC 320k）：

- `regret-film-1080p.mp4`：91 MB，码率约 5 Mbps，在这个目录里。和母版相比 PSNR 43.6 dB，正常观看看不出差别。
- 母版：322 MB，CRF 16。超过了 GitHub 单个文件 100 MB 的上限，没有放进仓库。按第 5 节的步骤可以重新渲染母版（同样的镜头、调色和参数）。

- 声音只有提供的背景音乐，没有旁白、人声、额外音效，也没有任何文字。
- 33 个镜头，33 段不同的实拍素材，没有重复使用。
- 32 个剪辑点全部落在小节强拍上，误差不超过 0.5 帧。

---

## 1. 音乐分析

工具：librosa 0.11 和 FFmpeg 7.0。脚本在 `tools/analysis/`，图表在 `docs/music_overview.png` 和 `docs/music_beats_zoom.png`。

| 项目 | 结果 |
|---|---|
| 总时长 | 144.82 s（ffprobe 容器时长），视频取 ceil(144.82 × 30) = 4345 帧 |
| BPM | **108**。线性拟合 254 个拍点，周期 0.5556 s，残差最大 83 ms |
| 倍速 / 半速复核 | beat_track 用 90 和 140 作先验都得到 107.7；用 70 作先验得到 53.8（半速）。自相关峰值为 107.7（0.81）、53.8（0.80）、35.9（0.81）。军鼓（>2 kHz）每 2 拍出现一次，底鼓 / 808 每 2 小节涨一次，按 4/4 拍算，108 BPM 是正确的拍速 |
| 小节 | 2.222 s 一小节，8 小节一个乐句（17.8 s） |
| 强拍 | 第 0 小节在 1.93 s。相位选的是 4 种相位中低频能量最高的一种（得分 5.27，其余 3.17–3.83）。每个强拍吸附到 ±70 ms 内最近的打击乐起音 |
| 起音 / 能量 | 每秒的 RMS、低频（30–150 Hz）、高频（>2 kHz）、起音强度见 `docs/music_analysis_raw.json` |

### 段落结构（以小节为单位，bar k = downbeats[k]）

| 时间 | 段落 | 听感 / 数据 | 画面处理 |
|---|---|---|---|
| 0–6.4 s | 前奏 | 只有铺底和低频涌动，没有打击乐 | 从黑场慢慢淡入，镜头时间长 |
| 6.4–8.6 s | 律动进入 | 6.4 s 进踩镲，8.6 s 进鼓 | 鼓进来时切换镜头 |
| 8.6–59.7 s | A 段主体 | 808 每 2 小节涨一次，22.0 s 是最响的一小节（−15.1 dB） | 每 2 小节换一个镜头，偶尔用 1 小节或 3 小节打破规律 |
| 59.7–62 s | 回落 | 61.78 s 停顿（−18 dB） | 镜头淡到黑场，停顿后再出画面 |
| 62–68.6 s | 过渡 | 低音退出，66.4 s 有一次涨起 | 城市远景，然后是云海入夜 |
| 68.6–73.1 s | breakdown | 主体部分最安静的地方（−25 dB），71.76 s 最低 | 长时间黑场（28 帧淡出 + 72 帧淡入），给音乐留白 |
| 73.1–97.5 s | B 段 | 安静的旋律段，没有低音，86.4 s 一次低频涌动 | 雾、森林、雪原、湖，镜头保持 4–7 s |
| 97.5–106.4 s | 渐强 | 高频逐渐增多，105.67 s 骤停 | 航拍后拉、穿过云层时加速推进，在骤停处淡到黑场 |
| 106.4–124 s | 高潮 | 全曲高频最密（>2 kHz 能量最高），持续保持高能量（约 −16.5 dB），123.5 s 短暂回落 | 黑场后 3 帧快速切入。镜头缩短到 1 小节，加手持感，换镜用 6 帧短叠化 |
| 124–139.7 s | 高潮尾段 | 最后一个完整乐句 | 回到 2 小节一个镜头，40 帧长叠化 |
| 139.7–144.8 s | 尾奏 | 音量逐渐降到无声 | 最后一个镜头放慢，从 140.4 s 起淡出，到 144.3 s 全黑 |

---

## 2. 镜头脚本

叙事线：**雨夜里的城市 → 窗边的人 → 离开 → 雾中独行 → 远方 → 遗憾（高潮）→ 余光**。镜头之间不交代具体故事，只表现人和环境之间的距离：先是城市，然后是窗，然后是路，最后是海。

完整参数（素材入点、变速、调色、运镜、氛围层）见 `src/data/shots.json`。

| # | 时间 | 时长 | 景别 / 内容 | 运镜 | 入场转场 |
|---|---|---|---|---|---|
| 01 | 0.00 | 4.2 | 特写：雨打车窗，城市光斑虚焦 | 慢推 + 横移 | 黑场淡入（66 帧） |
| 02 | 4.17 | 4.4 | 远景：大雾高速，钠灯 | 慢推 | 叠化 48 帧 |
| 03 | 8.60 | 4.5 | 中景：湿街倒影，出租车（鼓进入） | 横移 | 叠化 24 帧 |
| 04 | 13.07 | 4.4 | 中景：雨夜车流光斑 | 慢拉 | 叠化 10 帧 |
| 05 | 17.47 | 2.2 | 细节：雨滴落地 | 纵向下摇 | 叠化 12 帧 |
| 06 | 19.70 | 6.7 | 近景：路灯下独自吸烟的男人 | 慢推 + 手持 | 叠化 20 帧 |
| 07 | 26.40 | 4.4 | 主观镜头：窗外雾中的灯 | 横移 | 模糊转场 30 帧 |
| 08 | 30.83 | 4.4 | 全景：窗前女人的剪影推开窗 | 慢推 | 叠化 30 帧 |
| 09 | 35.27 | 4.5 | 全景：逆光坐在玻璃砖墙前（人物偏右） | 慢拉 | 叠化 30 帧 |
| 10 | 39.73 | 4.4 | 细节：手指在起雾的玻璃上画心 | 慢推 | 叠化 24 帧 |
| 11 | 44.17 | 2.2 | 近景：窗边等待的侧脸 | 手持漂移 | 叠化 16 帧 |
| 12 | 46.37 | 4.5 | 细节：流水的玻璃后，红灯晕开 | 慢推 | 叠化 20 帧 |
| 13 | 50.83 | 4.4 | 主观镜头：夜里开车出城 | 手持 | 叠化 16 帧 |
| 14 | 55.23 | 6.7 | 中景：雪中的老路灯 | 纵向摇 | 叠化 30 帧 |
| 15 | 61.97 | 4.4 | 大远景：远处的城市天际线 | 慢拉 | 黑场过渡（停顿处） |
| 16 | 66.40 | 4.4 | 大远景：云海由黄昏入夜（2.4 倍速延时） | 慢推 | 叠化 36 帧 |
| 17 | 70.80 | 6.7 | 航拍：雾漫过黑色森林 | 横移 | 长黑场（breakdown） |
| 18 | 77.50 | 6.6 | 远景：雨中灰色树林 | 上摇 | 叠化 45 帧 |
| 19 | 84.13 | 4.5 | 细节：雪中铁轨上的脚步 | 手持跟随 | 叠化 30 帧 |
| 20 | 88.60 | 4.4 | 远景：消失在雾里的雪路（0.75 倍速） | 慢推 | 叠化 30 帧 |
| 21 | 93.03 | 4.5 | 大远景：起雾的山湖 | 横移 | 叠化 36 帧 |
| 22 | 97.50 | 4.4 | 航拍后拉：田野间独行的人（渐强开始） | 后拉 | 叠化 20 帧 |
| 23 | 101.93 | 4.5 | 航拍：穿过云层和松岭 | 加速推进 | 叠化 16 帧 |
| 24 | 106.40 | 4.4 | 全景：山顶弹琴的剪影，落叶纷飞（高潮） | 推 + 手持 | 黑场后 3 帧切入 |
| 25 | 110.83 | 2.2 | 远景：海岸，男人走入画面 | 横移 | 叠化 6 帧 |
| 26 | 113.03 | 2.3 | 近景：女人走进海里，长发被风吹起 | 手持 | 叠化 6 帧 |
| 27 | 115.30 | 4.4 | 大远景：山巅的人与最后的光 | 慢拉 | 叠化 10 帧 |
| 28 | 119.67 | 2.3 | 中景：她走向礁石的背影 | 慢推 | 叠化 6 帧 |
| 29 | 121.93 | 2.2 | 中景：他站在浪里，望向别处 | 横移 | 叠化 6 帧 |
| 30 | 124.13 | 4.5 | 远景：栏杆边走向夕阳的剪影 | 横移 | 叠化 40 帧 |
| 31 | 128.60 | 4.5 | 近景：河边倚着栏杆的男人 | 慢推 | 叠化 36 帧 |
| 32 | 133.07 | 4.4 | 远景：多年以后，长椅上的老人与树 | 慢拉 | 黑场过渡 |
| 33 | 137.50 | 7.3 | 大远景：星空下的夜湖（尾奏） | 上摇 | 叠化 45 帧，最后淡出到黑 |

---

## 3. 视觉处理

- **素材**：Mixkit 免费实拍素材（[Mixkit License](https://mixkit.co/license/#videoFree)，可商用，不要求署名），素材 ID 见 `shots.json` 的 `clip` 字段。部分素材只能下载到 720p，用 lanczos 放大并轻度锐化，再叠加颗粒，在 1080p 下看不出明显差别。
- **统一调色**（`tools/grade.py`，FFmpeg）：降低饱和度，暗部偏蓝青，黑位微微抬起，高光柔和压缩，路灯和夕阳保留少量暖色。每个镜头只调曝光和饱和度，让所有素材落到同一套色调里。
- **运镜**（`src/lib/camera.ts`）：每个镜头的缩放、位移、变换中心、缓动曲线都不一样。手持感用几条频率互不成倍数的正弦波叠加，没有逐帧随机数，所以不会抖动。位移量会被限制，画面边缘不会露出来。
- **氛围层**：两层视差雾（无缝平铺的分形噪声，安静段落会自动变浓），两层不同景深的雨丝，漂浮的光尘，路灯辉光。这些层放在“镜头前面”，不跟着画面缩放。
- **全局**：2.2:1 遮幅，暗角会随音乐音量变化（安静时收紧），动态胶片颗粒。

---

## 4. 质量检查（`tools/qc.py`，全部通过）

```
PASS resolution 1920x1080
PASS frame rate 30/1
PASS video frames 4345 (expected 4345 = ceil(144.823s x 30))
PASS video length 144.833s vs music 144.823s
PASS audio matches source music (correlation 1.0000, offset 0.0 ms)
PASS no audio dropouts/glitches in 1 s windows
PASS audio level unchanged (rendered/source RMS 0.999)
PASS no unexpected black frames (101 near-black frames, all inside planned fades)
PASS ends on black / starts from black
PASS no sudden frame jumps outside cuts
PASS no frozen frames inside shots
PASS no repeated footage (33 shots, 33 unique clips)
PASS shot lengths 2.20-7.33s (mean 4.39s), none shorter than one bar
PASS all 32 cuts within 0.50 frames of a downbeat
```

肉眼检查过的内容：整片联系表（`docs/contact_sheet_*.jpg`），以及第 26.4 s、62 s、106.4 s、137.5 s 处转场前后的逐帧截图。

---

## 5. 项目结构与重新渲染

```
src/
  Root.tsx              Composition（1920×1080，30 fps，4345 帧）
  Film.tsx              镜头 Sequence、暗角、颗粒、结尾淡出、遮幅、<Audio>
  components/Shot.tsx   单个镜头：转场、运镜、氛围层
  components/fx/        Fog / Rain / Dust / Glow / FilmGrain
  lib/edit.ts           数据类型和读取
  lib/camera.ts         运镜和手持漂移
  data/music.json       拍速、强拍、段落（由分析脚本生成）
  data/shots.json       镜头脚本（调整剪辑时只需要改这个文件）
  data/timeline.json    逐帧时间线（由 build_timeline.py 生成）
  data/energy.json      每帧音量包络
tools/
  analysis/             音乐分析脚本（输出到 docs/ 和 src/data/music.json）
  fetch_footage.py      下载 shots.json 用到的 Mixkit 素材
  build_timeline.py     小节 → 帧，计算转场重叠
  prep_clips.py         素材裁切、变速、调色，输出 public/clips/
  make_textures.py      颗粒、雾贴图、音量包络
  qc.py                 自动质量检查
  patch_compositor.py   见下文
```

仓库里没有放素材和处理后的镜头（约 2 GB），第一次渲染前要先下载素材、生成镜头。需要 Node 18+、Python 3.10+，以及 PATH 里的 ffmpeg / ffprobe。

```bash
npm install
pip install -r requirements.txt

python tools/fetch_footage.py         # 从 Mixkit 下载 33 段素材到 footage/
python3 tools/build_timeline.py       # 小节 → 帧
python tools/prep_clips.py            # 裁切、变速、调色，输出 public/clips/
npx remotion render src/index.ts RegretFilm out/regret-film.mp4
python tools/qc.py                    # 自动质量检查
```

修改 `shots.json` 后，从 `build_timeline.py` 开始重新跑。只改了某几个镜头的话，可以只重做那几个：`python tools/prep_clips.py s07 s12`。

可以用环境变量 `FFMPEG`、`FFPROBE`、`FOOTAGE_DIR` 指定 ffmpeg、ffprobe 和素材目录的位置。

`public/fx/`（颗粒、雾贴图）和 `src/data/energy.json` 由 `python tools/make_textures.py` 生成，已经放进仓库，一般不需要重新生成。

**glibc 2.34 的机器**：Remotion 4.0.545 的 compositor 需要 glibc 2.35，它唯一缺的符号是 `hypot@GLIBC_2.35`，2.34 里有同样功能的 `hypot@GLIBC_2.2.5`。这种情况下先运行 `python3 tools/patch_compositor.py`，它会复制一份 compositor 到 `bin/compositor/` 并改掉这个版本依赖，`node_modules` 不受影响。`remotion.config.ts` 只在这份副本存在时才使用它，glibc ≥ 2.35 的机器什么都不用做。
