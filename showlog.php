<?php

const logfile = 'db/pedalhf_log.db';

if (!file_exists(logfile)) {
	header("Content-type: text/plain");
	echo "Sadly, no logs to show.\n";
	exit();
}

try {
	$db = new Sqlite3(logfile, SQLITE3_OPEN_READONLY);
	$db->enableExceptions(true);

	$query = $db->query(
		"SELECT DATE(time) AS date, TIME(time) AS clock, printf('%.3f', freq) AS fref, * FROM pedalhf_log ORDER BY time ASC");

	$logs = [];
	while ($r = $query->fetchArray(SQLITE3_ASSOC)) $logs[] = $r;
	$query->finalize();

} catch (Exception $e) {
	header("Content-type: text/plain");
	echo "Fatal Error: " . $e->getMessage() . "\n";
	exit;
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>PedalHF: Log Display</title>
	<link rel="stylesheet" href="pedalhf.css">
</head>
<body id="showlog">

<h1>PedalHF Log Output</h1>

<div>
	<a href="<?=logfile?>">[ download sqlite file ]</a>
</div>

<table>
	<tr>
		<th>Date</th>
		<th>Time</th>
		<th>Call</th>
		<th>Band</th>
		<th>Freq</th>
		<th>Mode</th>
		<th>RSTs</th>
		<th>RSTr</th>
	</tr>

	<?php foreach ($logs as $l): ?>

	<tr>
		<td><?=$l["date"]?></td>
		<td><?=$l["clock"]?></td>
		<td><?=$l["call"]?></td>
		<td><?=$l["band"]?></td>
		<td><?=$l["fref"]?></td>
		<td><?=$l["modu"]?></td>
		<td><?=$l["rsts"]?></td>
		<td><?=$l["rstr"]?></td>
	</tr>
	<tr><td colspan="8" class="note"><span>Note:</span> <?php echo nl2br($l["note"]); ?></td></tr>
	<?php endforeach; ?>
</table>



</body>
</html>
