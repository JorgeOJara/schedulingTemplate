CREATE USER IF NOT EXISTS 'scheduling_user'@'%' IDENTIFIED BY 'scheduling_pass';
GRANT ALL PRIVILEGES ON scheduling.* TO 'scheduling_user'@'%';
FLUSH PRIVILEGES;
