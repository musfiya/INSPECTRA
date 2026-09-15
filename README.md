\# INSPECTRA — AI Visual Inspection Platform



AI-powered multi-domain visual inspection platform for defect detection, classification, inspection history, and AI-assisted quality assessment.



\## Overview



INSPECTRA is an end-to-end AI visual inspection platform that integrates computer vision models with a FastAPI backend and an industrial-style web interface.



The platform supports three inspection domains:



\- PCB / Electronics

\- Automotive Parts

\- Semiconductor / Wafer



The goal of INSPECTRA is to demonstrate how trained deep-learning models can be integrated into a complete software system rather than functioning as standalone machine-learning models.



\---



\## Key Features



\- Multi-domain AI visual inspection

\- PCB defect detection using YOLOv8

\- Automotive defect detection using YOLOv8

\- Semiconductor wafer classification using ResNet18

\- Image upload and AI inference

\- PASS / FAIL inspection results

\- Confidence information

\- Defect detection and visualization

\- Bounding-box visualization for object-detection models

\- User registration and login

\- JWT-based authentication

\- Password hashing with bcrypt

\- Inspection history

\- SQLite database integration

\- Dashboard and analytics

\- Model performance information

\- Industrial dark-theme interface

\- REST API using FastAPI

\- Local CPU inference

\- Git LFS support for trained model files



\---



\# Supported Inspection Domains



\## 1. PCB / Electronics



\*\*Model:\*\* `models/pcb\_best.pt`



\*\*Architecture:\*\* YOLOv8n



\*\*Defect classes:\*\*



\- Mouse\_bite

\- Spur

\- Open\_circuit

\- Short

\- Missing\_hole

\- Spurious\_copper



The PCB model performs object detection and provides detected defect classes, confidence values, and bounding-box information.



\---



\## 2. Automotive Parts



\*\*Model:\*\* `models/automotive\_best\_yolo.pt`



\*\*Architecture:\*\* YOLOv8n



\*\*Defect classes:\*\*



\- dent

\- scratch

\- crack

\- glass shatter

\- lamp broken

\- tire flat



The automotive model performs object detection for visible automotive-part defects.



\---



\## 3. Semiconductor / Wafer



\*\*Model:\*\* `models/semiconductor\_best.pth`



\*\*Architecture:\*\* ResNet18



\*\*Classes:\*\*



\- Center

\- Donut

\- Edge-Loc

\- Edge-Ring

\- Loc

\- Near-full

\- Random

\- Scratch

\- none



The semiconductor model performs image classification for wafer defect patterns.



\---



\# System Architecture



```text

&#x20;                        INSPECTRA

&#x20;                           |

&#x20;            +--------------+--------------+

&#x20;            |                             |

&#x20;            v                             v

&#x20;     Web Application                FastAPI Backend

&#x20;      HTML/CSS/JS                 Authentication / API

&#x20;            |                             |

&#x20;            |                             v

&#x20;            |                    Unified AI Engine

&#x20;            |                             |

&#x20;            |              +--------------+--------------+

&#x20;            |              |              |              |

&#x20;            |              v              v              v

&#x20;            |           PCB YOLO     Automotive YOLO   Semiconductor

&#x20;            |                                           ResNet18

&#x20;            |              |              |              |

&#x20;            +--------------+--------------+--------------+

&#x20;                           |

&#x20;                           v

&#x20;                   Inspection Results

&#x20;                           |

&#x20;                           v

&#x20;                    SQLite Database

&#x20;                           |

&#x20;                           v

&#x20;               History / Dashboard / Reports

