<?php
declare(strict_types=1);

/* =====================================================================
   Configuration + outils communs (PHP 8.1+)
   ===================================================================== */

const DB_HOST = '127.0.0.1';
const DB_NAME = 'quiz_db';
require __DIR__ . '/config.php';   // contient DB_USER et DB_PASS (non versionné)             // à changer en production

const TIME_LIMIT         = 15;   // secondes par question (identique au JS)
const NET_GRACE          = 2;    // tolérance réseau en secondes
const QUESTIONS_PER_GAME = 8;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// Les endpoints publics sans état (ex. scores.php) peuvent définir NO_SESSION
if (!defined('NO_SESSION')) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => !empty($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function json_out(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400): never
{
    json_out(['error' => $message], $status);
}

function read_json(): array
{
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    return is_array($data) ? $data : [];
}

function require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        fail('POST required', 405);
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            fail('Database unavailable', 500);
        }
    }
    return $pdo;
}

// Nom de joueur : 12 caractères max, espaces normalisés, sans caractères de contrôle
function clean_name(mixed $value, string $fallback): string
{
    $s = is_string($value) ? $value : '';
    $s = preg_replace('/[\x00-\x1F\x7F]/u', '', $s) ?? '';
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    $s = mb_substr($s, 0, 12);
    return $s !== '' ? $s : $fallback;
}

// Une catégorie est valide si elle existe dans la table questions
function category_exists(string $cat): bool
{
    $st = db()->prepare('SELECT 1 FROM questions WHERE category = ? LIMIT 1');
    $st->execute([$cat]);
    return (bool)$st->fetchColumn();
}

// À partir d'une ligne de `questions`, renvoie [liste des réponses, index de la bonne réponse]
// (correct_answer est un texte : on cherche quelle option lui correspond)
function build_answers(array $row): array
{
    $answers = [];
    foreach (['option_a', 'option_b', 'option_c', 'option_d'] as $col) {
        $v = $row[$col] ?? null;
        if ($v !== null && trim((string)$v) !== '') {
            $answers[] = (string)$v;
        }
    }
    $target  = mb_strtolower(trim((string)($row['correct_answer'] ?? '')));
    $correct = -1;
    foreach ($answers as $i => $a) {
        if (mb_strtolower(trim($a)) === $target) {
            $correct = $i;
            break;
        }
    }
    return [$answers, $correct];
}