'use strict';

import System from 'system';
import { summary } from './harness.js';
import './cycler.test.js';
import './scroll.test.js';

const code = summary();
System.exit(code);
