<?php
declare(strict_types=1);
const NO_SESSION = true;
require __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    fail('GET required', 405);
}
$rows = db()->query(
    'SELECT DISTINCT category FROM questions WHERE category IS NOT NULL AND category <> "" ORDER BY category'
)->fetchAll(PDO::FETCH_COLUMN);

json_out(array_values($rows));