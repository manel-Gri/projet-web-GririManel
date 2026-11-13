<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_post();

// Appelé quand la question est affichée : c'est ici que le chrono serveur démarre.
$g = $_SESSION['game'] ?? null;
if (!is_array($g)) {
    fail('No game in progress', 409);
}
if ($g['finished']) {
    fail('Game already finished', 409);
}

$in  = read_json();
$qid = (int)($in['question_id'] ?? 0);
if ($qid !== ($g['ids'][$g['i']] ?? 0)) {
    fail('Wrong question', 409);
}

// Un second appel ne remet PAS le chrono à zéro (sinon on pourrait gagner du temps)
if (!$g['awaiting']) {
    $g['awaiting']  = true;
    $g['served_at'] = microtime(true);
    $_SESSION['game'] = $g;
}

json_out(['ok' => true, 'time' => TIME_LIMIT]);