// Job categories for the interview coach.
// All user-facing strings (openers, probe prompts, persona, blurb) are
// in Japanese so the audience can read them in the transcript.
//
// The persona strings are NOT sent to the model — they only describe
// the interviewer for our own UI. The model just sees the question text
// and the candidate's transcript, never the persona, so it cannot echo
// English persona text back as Japanese audio.

export type Difficulty = "junior" | "mid" | "senior";

export type VoiceTone = "warm" | "exact" | "direct";

export interface Category {
  id: string;
  name: string;
  jp: string;
  romaji: string;
  blurb: string;
  persona: string;
  probe: string[];
  openers: string[];
  mark: string;
  hue: number;
}

export const CATEGORIES: Category[] = [
  {
    id: "software",
    name: "ソフトウェアエンジニア",
    jp: "ソフトウェアエンジニア",
    romaji: "software engineer",
    blurb: "アルゴリズム、システム設計、バグの話。実際に下したトレードオフについて聞く。",
    persona:
      "落ち着いた観察力のあるシニアエンジニアとして振る舞う。何百人もの候補者を見てきた。バズワードには動じない。候補者が何を作り、何が壊れ、何を学んだか、正直に具体的な話を聞きたい。",
    probe: [
      "覆した技術的な判断と、その理由",
      "一日以上かかったバグの話",
      "速度・コスト・信頼性のトレードオフ",
    ],
    openers: [
      "エンドツーエンドで設計したシステムを一つ教えてください。自分が担当した部分と、そうでない部分はどこですか？",
      "最近関わったバグや障害について教えてください。最初の誤った仮定は何でしたか？",
      "直近のプロジェクトで技術スタックを選んだ理由を教えてください。今ならどう変えますか？",
    ],
    mark: "⌘",
    hue: 25,
  },
  {
    id: "product",
    name: "プロダクトマネージャー",
    jp: "プロダクトマネージャー",
    romaji: "product manager",
    blurb: "優先順位付け、ステークホルダー交渉、やらないことを決める力。",
    persona:
      "プロダクトディレクターとして、直接的で少しせっかち。ユーザー、課題、メトリクス、トレードオフをその順番で言えるかを見る。曖昧な答えには押し返す。",
    probe: [
      "不完全なデータで下したプロダクト判断",
      "上位ステークホルダーに「No」と言った経験",
      "自分が責任を負っていたメトリクス",
    ],
    openers: [
      "あなたが毎日使うプロダクトを一つ挙げてください。今四半期にひとつだけ変えるなら、何を、なぜ変えますか？",
      "機能を一つ削除した経験を教えてください。どうしてそれが正しい判断だと分かりましたか？",
      "プロダクトに害を与えると考えている機能を、最も大きなステークホルダーが要望しています。どのように話しますか？",
    ],
    mark: "◇",
    hue: 145,
  },
  {
    id: "data",
    name: "データサイエンティスト",
    jp: "データサイエンティスト",
    romaji: "data scientist",
    blurb: "統計的思考、実験設計、モデルと意思決定のギャップ。",
    persona:
      "研究のリーダーとして振る舞う。モデルが語ってくれないことを候補者が理解しているかを見る。交絡変数、サンプルサイズ、実際の意思決定を変えた研究について掘り下げる。",
    probe: [
      "予想を裏切ったA/Bテストの結果",
      "選択バイアスへの対処",
      "ノートブックでは動いたが本番で失敗したモデル",
    ],
    openers: [
      "ゼロから設計した実験を一つ教えてください。帰無仮説は何でしたか？どんな結果なら実験を中断しましたか？",
      "モデルとしてはうまく動いたが、ビジネス指標に響かなかった経験を教えてください。その次に何をしましたか？",
      "ステークホルダーから「倫理的に作れないモデル」を依頼されました。どうしましたか？",
    ],
    mark: "△",
    hue: 200,
  },
  {
    id: "design",
    name: "UXデザイナー",
    jp: "UXデザイナー",
    romaji: "designer",
    blurb: "プロセス、検証、トレードオフの理由。想定しなかったユーザーについて。",
    persona:
      "強いこだわりを持つデザインヘッドとして振る舞う。「ユーザーにテストした」は答えとして受け付けない。誰に、何人、何を変えて、何を変えなかったかを聞く。",
    probe: [
      "検証なしで行ったデザイン判断",
      "開発からの押し戻しへの向き合い方",
      "自分の作品でやり直したい部分",
    ],
    openers: [
      "誇りに思っているプロジェクトを一つ見せてください。削りたい部分とその理由は何ですか？",
      "直近のプロジェクトで「設計対象にしなかったユーザー」について教えてください。すべきでしたか？",
      "最も議論になったデザイン上の意見を一つ挙げてください。誰が正しかったですか？",
    ],
    mark: "○",
    hue: 320,
  },
  {
    id: "marketing",
    name: "マーケティング",
    jp: "マーケティング",
    romaji: "marketing",
    blurb: "キャンペーンの思考、計測、制約の中でのクリエイティブ判断。",
    persona:
      "グロースのVPとして振る舞う。CAC、リテンション、クリエイティブの品質を同じ文脈で聞く。数字と物語で自分の賭けを守れるかを見る。",
    probe: [
      "期待を下回ったキャンペーンと学んだこと",
      "ブランド判断 vs パフォーマンス判断",
      "クリエイティブを素早くテストする手法",
    ],
    openers: [
      "あなたが手掛けたキャンペーンを一つ教えてください。ゴールは何で、どうやって成功を測りましたか？",
      "一週間と小さな予算があります。何をテストするか、どう決めますか？",
      "CFOにクリエイティブの選択を擁護した経験を教えてください。どのような反論がありましたか？",
    ],
    mark: "✺",
    hue: 75,
  },
  {
    id: "sales",
    name: "セールス",
    jp: "セールス",
    romaji: "sales",
    blurb: "ヒアリング、异议対応、落とした商談と逆転勝ちした商談。",
    persona:
      "現場で戦ってきたセールスのディレクターとして、難しい場面をロールプレイする。数字と同じく自己認識を重視する。",
    probe: [
      "落としてはいけないと思っていた商談を失った話",
      "パイプラインから案件を外す基準",
      "自分から撤退した商談",
    ],
    openers: [
      "私にこの椅子を売ってください。2分あります。",
      "落とした商談を一つ教えてください。今振り返ると、負ける兆候の最初は何でしたか？",
      "40%のディスカウントを求められていますが、与えられない商談です。何と答えますか？",
    ],
    mark: "↗",
    hue: 50,
  },
  {
    id: "finance",
    name: "ファイナンス",
    jp: "ファイナンス",
    romaji: "finance",
    blurb: "モデリング、市場分析、案件の論理、守れる前提。",
    persona:
      "バイサイドのシニアアソシエイトとして振る舞う。倍数や成長率について曖昧な説明は受け付けない。前提を守れるかを見る。",
    probe: [
      "自分で作ったモデルと、最も重要だった入力",
      "やらなかった案件とその理由",
      "外れた市場観",
    ],
    openers: [
      "公開コンパのない未公開SaaS企業のvaluationを説明してください。最も重要な前提は何ですか？",
      "あなたが作ったモデルを一つ教えてください。10%動いたら結論がひっくり返る入力はどれですか？",
      "あなた自身が撤退した取引を一つ挙げてください。どうしてそれを知りましたか？",
    ],
    mark: "△",
    hue: 250,
  },
  {
    id: "consulting",
    name: "コンサルティング",
    jp: "コンサルティング",
    romaji: "consulting",
    blurb: "構造化された問題解決、フレームワーク、質問の裏にある問い。",
    persona:
      "エンゲージメントマネージャーとして、曖昧な問題を提示し、構造化できるかを見る。すべての前提にプレッシャーをかける。フレームワークに逃げさせない。",
    probe: [
      "クライアントに拒否された提案",
      "曖昧なブリーフのスコープ設定",
      "チームの見解を変えた分析",
    ],
    openers: [
      "あるコーヒーショップの売上が20%落ちました。どこから考えますか？",
      "クライアントが採用しなかった提案を一つ教えてください。どうして信じ続けましたか？",
      "病院が採用を増やさずに待ち時間を半減したいと考えています。どのようにアプローチしますか？",
    ],
    mark: "✦",
    hue: 15,
  },
];

export const DIFFICULTY: Record<Difficulty, { label: string; jp: string; tweak: string }> = {
  junior: {
    label: "初級",
    jp: "新卒",
    tweak:
      "経験2年未満の候補者として調整する。何を出したかではなく何を学んだかを聞く。励まししながらも正直に。曖昧な答えには優しくフォローアップする。",
  },
  mid: {
    label: "中級",
    jp: "中途",
    tweak:
      "経験2〜5年の候補者として調整する。数字と日付を含む具体例を期待する。答えがふわっとしていたら、具体的な瞬間を聞く。",
  },
  senior: {
    label: "上級",
    jp: "シニア",
    tweak:
      "経験5年以上の候補者として調整する。トレードオフの根拠と失敗の正直な説明を求める。リーダーシップの clichée は許さない — 候補者本人が何を実行したかを確認する。",
  },
};

export const TONE: Record<VoiceTone, { label: string; jp: string; suffix: string }> = {
  warm: {
    label: "やさしい",
    jp: "やさしい",
    suffix:
      "温かく、落ち着いた話し方。微笑みながら話す。「walk me through」ではなく「少し教えてください」から始める。励まししながらも具体的に。",
  },
  exact: {
    label: "ていねい",
    jp: "ていねい",
    suffix:
      "節度があり正確な話し方。はっきりとした口調で、落ち着いたペースで。無駄な言葉は使わない。良い答えには短く頷いて、次のもっと難しい質問へ進む。",
  },
  direct: {
    label: "はきはき",
    jp: "はきはき",
    suffix:
      "率直に、自信を持って。要点から入る。不親切ではないが、難しい質問にも角を立てない。答えが曖昧なら押し返す。",
  },
};

export const LENGTHS = {
  short: { label: "5分", questions: 4, seconds: 60 },
  medium: { label: "12分", questions: 8, seconds: 90 },
  long: { label: "20分", questions: 14, seconds: 90 },
} as const;

export type LengthKey = keyof typeof LENGTHS;

// Retained for backwards-compat — no longer used at runtime since we
// switched to per-answer scoring, but exported in case other code
// imports it.
export const SYSTEM_PROMPT = (
  category: Category,
  difficulty: Difficulty,
  tone: VoiceTone,
  length: LengthKey,
) => {
  const probeList = category.probe.map((p) => `  - ${p}`).join("\n");
  const openerList = category.openers.map((q, i) => `  ${i + 1}. ${q}`).join("\n");
  const t = TONE[tone];
  const d = DIFFICULTY[difficulty];
  const target = LENGTHS[length].questions;

  return `You are conducting a job interview in Japanese. The role is ${category.name}.

${category.persona}

Tone: ${t.suffix}

Calibration: ${d.tweak}

This will be a ${length} interview. Aim for about ${target} exchanges total.`;
};
