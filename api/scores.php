<?php
declare(strict_types=1);
const NO_SESSION = true;
require __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    fail('GET required', 405);
}

$pdo = db();

// ?best=1  =>  { hi, "Informatique": 1200, ... }
if (isset($_GET['best'])) {
    $out  = [];
    $rows = $pdo->query(
        'SELECT category, MAX(score) AS m FROM scores WHERE category IS NOT NULL GROUP BY category'
    )->fetchAll();
    foreach ($rows as $r) {
        $out[$r['category']] = (int)$r['m'];
    }
    $out = ['hi' => $out ? max($out) : 0] + $out;
    json_out($out);
}

// ?cat=all|<nom de catégorie>&limit=20
$cat   = (string)($_GET['cat'] ?? 'all');
$limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));

$sql = 'SELECT id, player_name, category, score, good, total_questions, `mode`,
               UNIX_TIMESTAMP(created_at) * 1000 AS date
        FROM scores';
$params = [];
if ($cat !== 'all') {
    $sql .= ' WHERE category = ?';
    $params[] = $cat;
}
$sql .= ' ORDER BY score DESC, created_at DESC, id DESC LIMIT ' . $limit;

$st = $pdo->prepare($sql);
$st->execute($params);

$list = array_map(static fn(array $r): array => [
    'id'    => (int)$r['id'],
    'name'  => $r['player_name'],
    'cat'   => $r['category'],
    'score' => (int)$r['score'],
    'good'  => (int)$r['good'],
    'total' => (int)$r['total_questions'],
    'mode'  => $r['mode'],
    'date'  => (int)$r['date'],
], $st->fetchAll());

json_out($list);