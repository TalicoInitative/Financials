// Differential test: regenerates randomized ledgers and cross-checks the app against
// an independent implementation of the spec's formulas (see oracle.py).
import {execSync} from 'node:child_process';
execSync('node diffgen.mjs',{stdio:'inherit'});
execSync('python3 oracle.py',{stdio:'inherit'});
