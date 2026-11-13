<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_post();

$g = $_SESSION['game'] ?? null;
if (!is_array($g)) {
    fail('No game in progress', 409);
}
if ($g['finished']) {
    fail('Game already finished', 409);
}
if (!$g['awaiting']) {
    fail('Question not ready or already answered', 409);   // empêche le double envoi
}

$in  = read_json();
$qid = (int)($in['question_id'] ?? 0);
if ($qid !== ($g['ids'][$g['i']] ?? 0)) {
    fail('Wrong question', 409);
}

$ans = (int)($in['answer'] ?? -1);
if ($ans < -1 || $ans > 3) {
    $ans = -1;
}

// Temps mesuré côté serveur : on ne fait jamais confiance au client
$elapsed = microtime(true) - (float)$g['served_at'];
if ($elapsed > TIME_LIMIT + NET_GRACE) {
    $ans = -1;                                             // trop tard = temps écoulé
}
$left = min(TIME_LIMIT, max(0, TIME_LIMIT - (int)floor($elapsed)));

$st = db()->prepare(
    'SELECT option_a, option_b, option_c, option_d, correct_answer FROM questions WHERE id = ?'
);
$st->execute([$qid]);
$row = $st->fetch();
if (!$row) {
    fail('Unknown question', 404);
}
[, $correct] = build_answers($row);
if ($correct < 0) {
    fail('Invalid question data', 500);
}

$ok     = ($ans === $correct);
$points = 0;
$mult   = 1;
if ($ok) {
    $g['combo']++;
    $g['good']++;
    $g['maxCombo'] = max($g['maxCombo'], $g['combo']);
    $mult          = min(3, 1 + intdiv($g['combo'] - 1, 2));
    $points        = (100 + $left * 10) * $mult;
    $g['score']   += $points;
} else {
    $g['combo'] = 0;
    $g['lives']--;
}

$g['i']++;
$g['awaiting']  = false;
$g['served_at'] = null;
$g['finished']  = ($g['lives'] <= 0 || $g['i'] >= count($g['ids']));
$_SESSION['game'] = $g;

json_out([
    'correct'       => $ok,
    'correct_index' => $correct,
    'points'        => $points,
    'mult'          => $mult,
    'combo'         => $g['combo'],
    'score'         => $g['score'],
    'lives'         => $g['lives'],
    'good'          => $g['good'],
    'maxCombo'      => $g['maxCombo'],
    'finished'      => $g['finished'],
]);