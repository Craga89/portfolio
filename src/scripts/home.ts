// The home page's interactive parts.
import { whenIdle } from './dom';
import './origin-trials';
import './anchors';
import './spy';
import './deck';
import './cases';
import './deeplinks';
import './bridge';
import './stack';
import './blog';
import './live';
import './ask';
import { bindAgentTools } from './webmcp';

whenIdle(bindAgentTools);
