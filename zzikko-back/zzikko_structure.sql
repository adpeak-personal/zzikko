-- 1. 데이터베이스 생성 및 선택
CREATE DATABASE IF NOT EXISTS zzikko DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE zzikko;

-- 2. 유저 테이블 (인증 및 계정 핵심: SNS 로그인 정보 기반)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, -- 고유 번호 (예: 1, 2, 3...)
    email VARCHAR(100), -- 이메일 주소 (예: 'user@kakao.com')
    sns_id VARCHAR(255) NOT NULL, -- SNS 고유 식별자 (예: '31245678')
    sns_type ENUM('KAKAO', 'APPLE', 'GOOGLE') NOT NULL, -- 가입 경로 (예: 'KAKAO')
    phone VARCHAR(20), -- 연락처 (예: '01012345678')
    name VARCHAR(50), -- 사용자 실명 (예: '홍길동')
    nickname VARCHAR(50) NOT NULL UNIQUE, -- 서비스 활동명 (예: '부천성지킬러')
    role ENUM('USER', 'SELLER', 'ADMIN', 'SUB_ADMIN') DEFAULT 'USER', -- 권한 (예: 일반유저, 판매자, 관리자)
    is_marketing_agree BOOLEAN DEFAULT FALSE, -- 마케팅 수신 동의 여부 (true/false)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 가입 일시
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- 정보 수정 일시
    last_connected_at TIMESTAMP NULL, -- 최종 접속 시간 (로그인 체크용)
    deleted_at TIMESTAMP NULL, -- 탈퇴 일시 (Soft Delete 방식)
    INDEX idx_sns (sns_id, sns_type), -- SNS 로그인 검색 최적화
    INDEX idx_role (role) -- 권한별 유저 필터링 최적화
) ENGINE=InnoDB;

-- 3. 유저 프로필 테이블 (추가 정보: 특정 서비스 신청 시 보완)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id BIGINT PRIMARY KEY, -- users.id와 1:1 관계
    gender ENUM('MALE', 'FEMALE', 'NONE') DEFAULT 'NONE', -- 성별 (예: 'MALE')
    profile_image TEXT, -- 원본 프로필 이미지 URL (S3 경로 등)
    profile_thumbnail TEXT, -- 썸네일 이미지 URL (리스트 출력용)
    birthday DATE NULL, -- 생년월일 (예: '1995-05-20')
    region_code VARCHAR(10), -- 주 활동 지역 코드 (예: '032' 또는 행정동코드)
    addresses JSON NULL, -- 배송지/방문지 목록 (예: [{"label": "우리집", "address": "경기도 부천시...", "is_default": true}])
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- 프로필 수정 시간
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. 셀러 정보 테이블 (판매자 권한 신청 및 관리)
CREATE TABLE IF NOT EXISTS sellers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, -- 셀러 고유 번호
    user_id BIGINT NOT NULL UNIQUE, -- 신청한 유저 ID (users.id)
    biz_name VARCHAR(100) NOT NULL, -- 상호명 (예: '대박통신 부천점', '깔끔이사')
    biz_number VARCHAR(20), -- 사업자 등록 번호 (예: '123-45-67890')
    biz_type ENUM('INDIVIDUAL', 'CORPORATE') DEFAULT 'INDIVIDUAL', -- 사업자 구분 (개인/법인)
    rep_name VARCHAR(50), -- 대표자 성명 (예: '김철수')
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') DEFAULT 'PENDING', -- 승인 상태 (대기/승인/거절/정지)
    rejected_reason TEXT NULL, -- 승인 거절 시 사유 기록 (예: '사업자등록증 식별 불가')
    approved_at TIMESTAMP NULL, -- 최종 승인 처리 일시
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 신청 일시
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- 정보 변경 일시
    CONSTRAINT fk_seller_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;