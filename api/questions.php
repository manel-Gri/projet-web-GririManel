<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_post();

$in  = read_json();
$cat = trim((string)($in['cat'] ?? ''));
if ($cat === '' || !category_exists($cat)) {
    fail('Invalid category');
}
$name = clean_name($in['name'] ?? '', 'JOUEUR');
$mode = (($in['mode'] ?? '') === 'group') ? 'group' : 'solo';
// En groupe, la seed vient du client (mêmes questions pour tous). En solo, le serveur décide.
$seed = ($mode === 'group' && isset($in['seed']))
    ? max(1, (int)$in['seed'])
    : random_int(1, 2147483000);
$st = db()->prepare(
    'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer
     FROM questions WHERE category = ? ORDER BY id'
);
$st->execute([$cat]);

// On n'envoie JAMAIS correct_answer au navigateur
$byId = [];
foreach ($st->fetchAll() as $row) {
    [$answers, $correct] = build_answers($row);
    if (count($answers) < 2 || $correct < 0) {
        continue;                                   // question mal remplie : ignorée
    }
    $byId[(int)$row['id']] = [
        'id'      => (int)$row['id'],
        'text'    => $row['question_text'],
        'answers' => $answers,
        'type'    => count($answers) === 2 ? 'vf' : 'qcm',   // <-- ajout

    ];
}
if (!$byId) {
    fail('No questions for this category', 404);
}

// Tirage déterministe : même seed => mêmes questions (mode groupe)
$ids = array_keys($byId);
mt_srand($seed);
shuffle($ids);
$ids = array_slice($ids, 0, QUESTIONS_PER_GAME);
$questions = array_map(static fn(int $id): array => $byId[$id], $ids);


$_SESSION['game'] = [
    'ids'       => array_column($questions, 'id'),
    'i'         => 0,
    'score'     => 0,
    'combo'     => 0,
    'maxCombo'  => 0,
    'good'      => 0,
    'lives'     => 3,
    'cat'       => $cat,
    'name'      => $name,
    'mode'      => $mode,
    'served_at' => null,
    'awaiting'  => false,
    'finished'  => false,
];

json_out(['questions' => $questions]);