# 音频参考

阶段 1（音频体检与衔接方案）、阶段 3（音效处理）、阶段 4（成片复测）用到的细节。命令都在仓库根目录执行，脚本路径按 Skill 的实际位置调整。

## 1. 读 audio_probe.py 的报告

| 报告项 | 怎么读 |
|---|---|
| 综合响度（LUFS） | 整首歌的平均响度。两首歌按它对齐：偏响的那首单向压低。 |
| True Peak（dBTP） | 采样之间的真实峰值。超过 -1 dBTP 时，编码成 AAC 后可能削波，脚本会自动多压一点。 |
| BPM 与置信度 | 置信度看的是拍点和实际起音对得上多少：高 = 中位偏差 ≤ 20 ms、超过一半的拍有明显起音、前后段不漂移。中/低就要听辨。 |
| 半速/倍速 | ACF 接近或注明“可能是半速”时，两种速度都说得通，用耳朵定：跟着拍手，哪个速度更自然就用哪个。 |
| 小节首拍 | 按 4/4 估计，取低频起音最强的相位。最高/次高 ≥ 1.3 为高。脚本吸附到小节首拍的点都要在 Studio 里听一遍。 |
| 能量走势 | “级别”按这首歌自己的中位响度分（高 ≥ +1.5 LU，低 ≤ -2.5 LU）；“律动”是起音强度相对全曲中位数的倍数，用来区分同样响但更满（密）和更空（疏）的段落。 |
| 段落变化 | 前后 4 秒的响度差 ≥ 3 LU 记为抬升或回落，并吸附到小节首拍。抬升适合当起播点和爆点，回落适合当切出点和收尾。 |
| 天然气口 | 比周围 ±2.5 秒的平均响度低 6 dB 以上、并且低于局部底噪的凹陷，或者绝对静音。“时间段”的起点是乐句末尾，用来切出和收尾；“下一句起点”用来接入。 |

报告只给候选。最后用哪个点，由用户在阶段 1 的门禁上确认。

## 2. 起播点

- 跳过“开头静音”。
- 看“前 15 秒相对响度”：接近 0 说明开头就有推进感；低于 -4 LU 一般是慢前奏。慢前奏有两种处理：换到第一次能量抬升处起播，或者保留前奏、让画面在前 3 秒就给出最强的冲突或结论。
- 起播点落在小节首拍上，否则第一拍就和画面错位。

## 3. 两首歌的衔接

### 音量系数（只压不抬）

- 先把偏响的那首压到较轻那首的综合响度，再检查每首的 True Peak；超过上限的话两首一起再压。系数都 ≤ 1。
- 系数 = 10^(增益dB/20)。-3 dB 是 0.708，-6 dB 是 0.501。不要写成 10^(dB/10)，那样会多压一倍的分贝数。
- 只压不抬可能让整片偏小声，这个在阶段 4 的成片复测里处理，不在混音时拉高。

### 切出点、接入点、交叉淡化

- 切出点用 A 的乐句末尾或段落回落；`--switch-at` 表示叙事转折大约在目标时长的哪个比例，转折位置变了就改参数重跑。
- 接入点用 B 的段落抬升（保持推进感）或气口后的下一句。B 的曲首通常是慢前奏，放在视频中段会泄气。
- 交叉淡化长度：两首速度接近（相差 6% 以内或 2:1）时用 1 小节；速度不同时节拍对不齐，用 0.5～0.8 秒的短交叉淡化，放在 A 的气口里，必要时用转场音效遮住。
- 用等功率曲线（淡出 cos、淡入 sin）。线性交叉淡化在中点两边都只剩一半振幅，响度会凹下去约 3 dB。
- 衔接处响度变化（报告第 4 条）超过 ±4 LU 时，确认这是想要的爆发；不是的话换 B 的接入点。
- 交叉淡化的重叠段两首电平相加，成片一定要复测 True Peak。

### Remotion 写法

先看仓库里现有合成用的是哪个音频组件，保持一致：

- `@remotion/media` 的 `<Audio>`：新项目推荐。
- `remotion` 的 `<Audio>` / `<Html5Audio>`：4.0.319 起用 `trimBefore`；4.0.530 起有 `durationInFrames`；更老的版本用 `startFrom` / `endAt`。

下面用 `<Sequence>` 控制起点和长度，两种组件、新旧版本都适用。帧号直接抄报告里的“Remotion 参数”（合成时间轴上的绝对帧）。

```tsx
import {Audio} from '@remotion/media'; // 或者项目里现有的 import {Audio} from 'remotion'
import {Easing, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// 数字来自 audio_probe.py 报告的“Remotion 参数”
const A = {trimBefore: 0, duration: 1110, volume: 1.0, fadeOut: [1092, 1110]};
const B = {from: 1092, trimBefore: 454, duration: 1157, volume: 0.495, fadeIn: [1092, 1110], fadeOut: [2191, 2248]};

export const Bgm: React.FC = () => {
  const f = useCurrentFrame(); // 放在合成根部，这里的 f 就是绝对帧
  // 等功率：Easing.sin = 1 - cos(πt/2)，所以 [1, 0] 配 Easing.sin 得到 cos(πt/2)；
  // Easing.out(Easing.sin) = sin(πt/2)，用于淡入。
  const aOut = interpolate(f, A.fadeOut, [1, 0], {...clamp, easing: Easing.sin});
  const bIn = interpolate(f, B.fadeIn, [0, 1], {...clamp, easing: Easing.out(Easing.sin)});
  const bOut = interpolate(f, B.fadeOut, [1, 0], {...clamp, easing: Easing.sin});
  return (
    <>
      <Sequence durationInFrames={A.duration} layout="none">
        <Audio src={staticFile('<合成名>/bgm-a.mp3')} trimBefore={A.trimBefore} volume={A.volume * aOut} />
      </Sequence>
      <Sequence from={B.from} durationInFrames={B.duration} layout="none">
        <Audio src={staticFile('<合成名>/bgm-b.mp3')} trimBefore={B.trimBefore} volume={B.volume * bIn * bOut} />
      </Sequence>
    </>
  );
};
```

音量要在 `<Sequence>` 外面用绝对帧算好再传进去；如果在 `<Sequence>` 里面调用 `useCurrentFrame()`，拿到的是相对帧，淡入淡出的帧号要相应减去 `from`。

## 4. 收尾

- 收尾点优先选乐句末尾（气口）或段落回落，淡出 1 小节（小节长 1.5～3 秒时）或 2 秒。
- 最后一句文案（含爆点定格）结束后，片尾不超过 3 秒；BGM 剩下的空尾奏全部裁掉。片尾要放标题或关注引导时，也算在这 3 秒里。

## 5. 音效

### 来源

- 优先用已安装的 `sound` skill 检索和下载，按它自己的说明操作。
- 没有这个 skill 时：Freesound（按许可证筛选 CC0）、Kenney 的音效包（CC0）。
- Pixabay、Mixkit 的音效都有各自的许可证，不是 CC0，不能当 CC0 用。Freesound 上 CC0、CC-BY、CC-BY-NC 混在一起，下载前逐条看。

### 清单与处理

复制 `assets/sfx-manifest-template.csv`，每个音效一行，写清来源网址、作者、许可证，然后：

```bash
python3 .agents/skills/music-graphic-video/scripts/prep_sfx.py --manifest docs/<合成名>/sfx.csv --out-dir public/<合成名>/sfx
```

脚本会去头尾静音（-50 dB 以下）、按 `max_len` 截短、加 5 ms 淡入和短淡出、峰值归一化到 -6 dBFS、转成 48 kHz 立体声 WAV，拒绝非 CC0 的条目，并写出 `sfx-credits.csv`。

各类动作的参考长度：点击 0.15～0.3 秒，翻页/纸张 0.4～0.8 秒，印章 0.3～0.6 秒，转场嗖声 0.5～1.0 秒。

### 混音

- 音效在 Remotion 里的 volume 从 0.3～0.5 起试，在 Studio 里和 BGM 一起听。
- 音效结束点不能越过下一个镜头的切点；离切点太近就截短或提前触发。
- 重拍音效只配重拍动效。连续的小动作（逐字出现）用一个短音效代表一组，不要每个字一声。

## 6. 成片复测（阶段 4）

```bash
python3 .agents/skills/music-graphic-video/scripts/audio_probe.py out/<成片>.mp4 --master
```

- True Peak 必须 ≤ -1 dBTP。超限时报告会列出时间段（多半是交叉淡化重叠段或音效叠加处），按时间段压低对应音效或音轨的系数，再重新渲染。
- 音视频时长差超过 1 帧时，检查合成时长和音频裁切。
- 综合响度偏小声（比参考值 -14 LUFS 低 2 LU 以上）时，可以在用户同意后做两遍 loudnorm 整体抬升，上限仍然守住 -1 dBTP：

```bash
# 第一遍：测量，记下输出 JSON 里的 input_i / input_tp / input_lra / input_thresh / target_offset
ffmpeg -i out/<成片>.mp4 -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null -
# 第二遍：用测量值做线性增益；loudnorm 内部会升到 192 kHz，必须用 -ar 48000 转回来
ffmpeg -i out/<成片>.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=<input_i>:measured_TP=<input_tp>:measured_LRA=<input_lra>:measured_thresh=<input_thresh>:offset=<target_offset>:linear=true" -ar 48000 -c:a aac -b:a 320k out/<成片>_loudnorm.mp4
```

处理完再跑一次 `--master` 确认。
