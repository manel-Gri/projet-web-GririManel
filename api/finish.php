<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_post();

// Le score vient UNIQUEMENT de la session serveur, jamais du client.
$g = $_SESSION['game'] ?? null;
if (!is_array($g)) {
    fail('No game in progress', 409);
}
if (!$g['finished']) {
    fail('Game not finished', 409);
}

$pdo   = db();
$score = (int)$g['score'];
$total = count($g['ids']);

// Record de la catégorie AVANT insertion
$st = $pdo->prepare('SELECT COALESCE(MAX(score), 0) FROM scores WHERE category = ?');
$st->execute([$g['cat']]);
$previous = (int)$st->fetchColumn();

$id = null;
if ($score > 0) {
    $st = $pdo->prepare(
        'INSERT INTO scores (player_name, category, score, good, total_questions, `mode`)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $st->execute([$g['name'], $g['cat'], $score, (int)$g['good'], $total, $g['mode']]);
    $id = (int)$pdo->lastInsertId();
}

// Évite tout double enregistrement
unset($_SESSION['game']);

json_out([
    'id'       => $id,
    'score'    => $score,
    'good'     => (int)$g['good'],
    'total'    => $total,
    'maxCombo' => (int)$g['maxCombo'],
    'record'   => $score > 0 && $score > $previous,
]);