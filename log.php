<?php
header("Content-type: application/json");

// let pedalhf ask if there's php

if (@$_REQUEST["enable"])
	endme("logging is enabled", true);


// enable and create databases
const logfile = 'db/pedalhf_log.db';

// the opportunity to make every field four characters
// is too strong.
const schema = <<<EndSQL
CREATE TABLE pedalhf_log (
	lgid integer not null primary key,
	call text not null default '',
	rsts integer not null default 0,
	rstr integer not null default 0,
	note text,
	band text not null default '',
	freq numeric not null default 0,
	modu text not null,
	time text not null
);
EndSQL;

$create_table = file_exists(logfile);

try {
	$db = new Sqlite3(logfile);
	$db->enableExceptions(true);
} catch (Exception $e) {
	endme("db open failed: " . $e->getMessage());
}

try {
	if ($create_table == false) {
		$db->query(schema);
	}
} catch (Exception $e) {
	endme("schema create failed " . $e->getMessage());
}


// try to clean incoming data

if ( ($call = trim(strtoupper(@$_REQUEST["call"]))) === "")
	endme("call sign required");

if ( ($freq = (float) @$_REQUEST["freq"]) === 0)
	endme("freq required");

if ( ($modu = trim(strtoupper(@$_REQUEST["mode"]))) === "")
	endme("mode required");

if ( ($time = trim(strtoupper(@$_REQUEST["time"]))) === "")
	endme("time required");


$rsts = (int) @$_REQUEST["rsts"];
$rstr = (int) @$_REQUEST["rstr"];

try {
	$bands = json_decode(file_get_contents("js/bands.json"));
	if (count($bands) == 0) throw new Exception("bands is zero length");
} catch (Exception $e) {
	endme("can't load bands: ".$e->getMessage());
}

$band = "";
foreach ($bands as $b) {
	if ($freq >= $b->low && $freq <= $b->high) {
		$band = $b->adif;
	}
}
if ($band == null) $band = 'none';

// and finally, commit
//
$sql = sprintf(
	"INSERT INTO pedalhf_log(call, note, band, modu, time, rsts, rstr, freq) ".
	"VALUES('%s', '%s', '%s', '%s', '%s', %d, %d, %f)",
	$db->escapeString($call),
	$db->escapeString(@$_REQUEST["note"]),
	$db->escapeString($band),
	$db->escapeString($modu),
	$db->escapeString($time),
	$rsts,
	$rstr,
	$freq
);

try {
	$db->query($sql);
} catch (Exception $e) {
	endme("log query failed: ".$e->getMessage());
}

endme("log query succeeds: $sql", true);



function endme(string $text, bool $bool = false) {
	echo json_encode([ $bool, $text ]);
	exit;
}

