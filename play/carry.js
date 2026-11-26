// ---- 乗せられるか：ペンギンを乗せて、潰れずに立てるか（11/26 の決めごと）----
// 背中の形は関係なし（どんな形でも、乗った所がむにっと凹んで座れる）。効くのは脚と大きさ。計算は shared/judge.js（工房の「支える脚」と同じ）
window.PlayCarry = (() => ({ measure: B => window.BoneJudge.carryJudge(B.D.bones, B.rest, B.Hm || 0.7) }))();
